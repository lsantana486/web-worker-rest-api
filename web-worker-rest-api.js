/**
 * License: MIT
 */
(function (angular) {
    'use strict';

    /**
     * @ngdoc overview
     * @name web-worker-rest-api
     */
    angular.module('web-worker-rest-api', [])
        .provider("webWorkerConfig", function () {
            "use strict";
            
            var WebWorkerConfig = ['$log','script',function($log,script){
               $log.info("webWorkerConfig");
               this.script = script;
            }];
            
            return {
                $get:['$injector',function($injector) {
                    return $injector.instantiate(WebWorkerConfig, {
                        script: this.script || "bower_components/web-worker-rest-api/worker.js"
                    });
                }],
               setScript: function (value) { 
                   this.script = typeof value === "string" ? value:"../bower_components/web-worker-rest-api/worker.js";
               }  
            };

        }).run(['$rootScope','$log','webWorkerConfig','callWebWorker',function($rootScope,$log,webWorkerConfig,callWebWorker) {
            $log.debug("webWorkerConfig : " , webWorkerConfig);
            var workerScript = webWorkerConfig.script;
            var worker = new Worker(workerScript);
            callWebWorker.setWorker(worker);

        }]).factory('callWebWorker', ['$rootScope','$q','$log','webWorkerConfig',function($rootScope,$q,$log,webWorkerConfig) {
            $log.info("callWebWorker");
            var workerSingleton;
            var workerQueue = [];
            
            function startWorker(workerRequest){
                $log.info("startWorker");
                workerSingleton.postMessage(workerRequest);

            }
            
            function setWorker(worker){
                $log.info("setWorker");
                workerSingleton = worker;
                workerSingleton.onmessage = function(e) {
                    $log.debug("Response from web worker: ",e);
                    if(e.data.hasOwnProperty("success")){
                        $rootScope.$broadcast(e.data.endpoint.event.success, e.data);
                        
                    }else if(e.data.hasOwnProperty("message")){
                        if(e.data.message == "from_queue")
                            invokeFromQueue();
                            
                    }else if(e.data.hasOwnProperty("error")){
                        $rootScope.$broadcast(e.data.endpoint.event.error, e.data);
                        
                    }
                };
            }
            
            function addToRefreshQueue(data){
                $log.info("addToRefreshQueue");
                $log.debug("Data to put on queue: ",data);
                var checkObj = _.filter(workerQueue, {'widget_id':data.widget_id});
                if(checkObj.length > 0){
                    _.remove(workerQueue, function(obj) {
                        return obj.widget_id === data.widget_id;
                    });
                }
                workerQueue.push(data);
                $log.debug("On queue: ",workerQueue);
            }
            
            function removeFromRefreshQueue(id){
                $log.info("removeFromRefreshQueue");
                _.remove(workerQueue, function(obj) {
                    return obj.widget_id === id;
                });
                $log.debug("On queue: ",workerQueue);
            }

            function invokeFromQueue(){
                $log.info("invokeFromQueue");
                startWorker(workerQueue);
            }
            
            return {
                startWorker:startWorker,
                setWorker: setWorker,
                addToRefreshQueue: addToRefreshQueue,
                removeFromRefreshQueue: removeFromRefreshQueue
            };
        }]);

})(angular);