/**
 * License: MIT
 */
(function (angular) {
    'use strict';

    /**
     * @ngdoc overview
     * @name web-worker-rest-api
     */
    angular.module('web-worker-rest-api', ['ionic'])
        .provider("webWorkerConfig", function () {
            "use strict";
            
            var WebWorkerConfig = ['$log','endpoints','headers','auto_refresh','database','script',function($log,endpoints,headers,auto_refresh,database,script){
               $log.info("webWorkerConfig");
               this.headers = headers;
               this.endpoints = endpoints;
               this.auto_refresh = auto_refresh;
               this.database = database;
               this.script = script;
            }];
            
            return {
                $get:['$injector',function($injector) {
                    return $injector.instantiate(WebWorkerConfig, {
                        headers: this.headers || {"Content-Type":"application/json","X-Ionic-Application-Id":"","X-Authorization":""},
                        endpoints: this.endpoints || [],
                        auto_refresh: this.auto_refresh || false,
                        database: this.database || "default",
                        script: this.script || "lib/web-worker-rest-api/worker-ios.js"
                    });
                }],
               setHeaders: function (value) { 
                   this.headers = typeof value === "object" ? value:{"Content-Type":"application/json","X-Ionic-Application-Id":"","X-Authorization":""};
               },
               setIniEndpoints: function (value) { 
                   this.endpoints = typeof value === "object" ? value:[];
               },
               setAutoRefreshIniEndpoint: function (value) { 
                   this.auto_refresh = typeof value === "boolean" ? value:false;
               },
               setDatabase: function (value) { 
                   this.database = typeof value === "string" ? value:"default";
               },
               setScript: function (value) { 
                   this.script = typeof value === "string" ? value:"js/default.js";
               }  
            };
        }).config(['webWorkerConfigProvider',function(webWorkerConfigProvider) {
            /*
             *  Temaple for config options
             *  
             *  var obj = [{
             *      endpoint:"http://api.club.lanacion.com.ar/peugeot?pagesize=1",
             *      key_id:"Peugeot"
             *  }];
             *  
             *  var headers = {};
             *      headers['Content-Type'] = 'application/json';
             *      headers['X-Ionic-Application-Id'] = settings.get('app_id');
             *      headers['X-Authorization'] = settings.get('api_key');
             * 
             *  webWorkerConfigProvider.setIniEndpoints(obj);
             *  webWorkerConfigProvider.setDatabase("lista");
             *  webWorkerConfigProvider.setAutoRefreshIniEndpoint(true);
             *  webWorkerConfigProvider.setScript("js/worker-db.js");
             *  webWorkerConfigProvider.setHeaders(headers);
             *
             */
            var script = ionic.Platform.isIOS() ? "lib/web-worker-rest-api/worker-ios.js":"lib/web-worker-rest-api/worker-android.js";
            webWorkerConfigProvider.setScript(script);
            
        }]).run(['$ionicPlatform','$rootScope','$log','webWorkerConfig','callWebWorker',function($ionicPlatform,$rootScope,$log,webWorkerConfig,callWebWorker) {
            $ionicPlatform.ready(function() {
                $log.debug("webWorkerConfig : " , webWorkerConfig);
        
                var workerScript = webWorkerConfig.script;
                var endpoints = webWorkerConfig.endpoints;
                var addToRefreshQueue = webWorkerConfig.auto_refresh;
                var database = webWorkerConfig.database;
                var headers = webWorkerConfig.headers;
                    
                var worker = new Worker(workerScript);
                callWebWorker.setWorker(worker);
                
                var method = {action:"ini",param:{database:database}};
                var workerRequestIni = {database:method,headers:headers};
                worker.postMessage({config:workerRequestIni}); 
                
                if(endpoints.length !== 0){
                    var workerRequest = {endpoints:endpoints};
                    if(addToRefreshQueue){
                        callWebWorker.addToRefreshQueue(workerRequest);
                    }
                    worker.postMessage(workerRequest);    
                }
            });
        }])
        
        .factory('callWebWorker', ['$rootScope','$q','$log','webWorkerConfig',function($rootScope,$q,$log,webWorkerConfig) {
            $log.info("callWebWorker");
            var workerSingleton;
            var database = webWorkerConfig.database;
            var refresh_queue = [];
            var db;
            
            function startWorker(workerRequest){
                $log.info("startWorker");
                workerSingleton.postMessage(workerRequest);
            }
            
            function setWorker(worker){
                $log.info("setWorker");
                workerSingleton = worker;
                workerSingleton.onmessage = function(e) {
                    $log.debug("Response from web worker: ",e);
                    if(e.data.hasOwnProperty("status")){
                        $rootScope.$broadcast("worker:db:"+database+":update", e.data);
                        
                    }else if(e.data.hasOwnProperty("message")){
                        invokeFromQueue();
                            
                    }else if(e.data.hasOwnProperty("error")){
                        $rootScope.$broadcast("worker:endpoint:error", e.data);
                        
                    }else if(e.data.hasOwnProperty("to_db")){
                        saveToDB(e.data.to_db);
                    }
                };
            }
            
            function addToRefreshQueue(data){
                $log.info("addToRefreshQueue");
                $log.debug("Data to put on queue: ",data);
                if(data.hasOwnProperty("endpoints")){
                    refresh_queue = refresh_queue.concat(data.endpoints);
                    _.forEach(data.endpoints, function(item) {
                        _.remove(refresh_queue, function(obj) {
                            return obj.key_id === item.key_id;
                        });
                        refresh_queue.push(item);
                    });
                }else if(data.hasOwnProperty("endpoint")){
                    _.remove(refresh_queue, function(obj) {
                        return obj.key_id === data.key_id;
                    });
                    refresh_queue.push(data);    
                }
                $log.debug("On queue: ",refresh_queue);
            }
            
            function invokeFromQueue(){
                $log.info("invokeFromQueue");
                startWorker({endpoints:refresh_queue});
            }
            
            function saveToDB(obj){
                $log.info("saveToDB");
                var document = obj.doc;
                var keyId = obj.key_id;
                
                db = new PouchDB(database);
                var text;                        
                db.changes({since: 'now', live: true, include_docs: true})
                  .on('change',function(change) {
                      $log.debug(text,change);
                      text = "Database " + database + " change: ";
                      $rootScope.$broadcast("worker:db:"+database+":update", {status:"success",key:keyId});
                  }).on('complete', function(info) {
                      text = "Database " + database + " complete: ";
                      $log.debug(text,info);
                  });
                
                //Update or Insert document
                db.get(keyId).then(function(doc) {
                    document._rev = doc._rev;
                    document._id = keyId;
                    return db.put(document);
                }).then(function(response) {
                    $log.debug("Get/Put Response from PouchDB: ",response);
                    
                }).catch(function (err) {
                    $log.error("Get Error from PouchDB: ",err);
                    if (err.status === 404) {
                        document._id = keyId;
                        return db.put(document);
                    }else{
                        throw err;
                    }
                    
                }).then(function(response) {
                    $log.debug("Put Response from PouchDB: ",response);
                    
                }).catch(function (err) {
                    $log.error("Put Error from PouchDB: ",err);
                    $rootScope.$broadcast("worker:db:"+database+":update", {status:"fail",key:keyId});
                    
                });
            }
            
            return {
                startWorker:startWorker,
                setWorker: setWorker,
                addToRefreshQueue: addToRefreshQueue
            };
        }]);

})(angular);