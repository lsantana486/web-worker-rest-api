importScripts('../lodash/dist/lodash.js');
importScripts('../pouchdb-5.2.1.min.js');

//Global variable for database
var db;
var Headers;

//Event Listener for message from the main thread
this.onmessage = function (e) {
    console.log('OnMessage Data: ',e);
    
    //Variable to handle the request from main thread
    var requestWorker = e.data;
     
    if(requestWorker.hasOwnProperty("config")){
        //Ini database
        pouchDB(requestWorker.config.database);
        //Ini Headers
        Headers = requestWorker.config.headers
    }else if(requestWorker.hasOwnProperty("endpoints")){
        //Call endpoint
        getDataFromURL(requestWorker);
    }
    
}

//Class object to handle HTTP requests
var HttpClient = function () {
    this.get = function (Endpoint, Callback) {
            var HttpRequest = new XMLHttpRequest();
            HttpRequest.onreadystatechange = function () {             
                if (HttpRequest.readyState == 4 && HttpRequest.status == 200) {
                        console.log("Worker - Http Response: ",HttpRequest.responseText);
                        Callback(HttpRequest.responseText);
                        
                }else if(HttpRequest.readyState == 4 && HttpRequest.status == 503){
                    Callback('{"status":"error", "message":"Backend Unavailable"}');
                    
                }else if(HttpRequest.readyState == 4 && HttpRequest.status == 0){
                    Callback('{"status":"error", "message":"Backend Unavailable"}');
                      
                }              
            }        
            HttpRequest.open("GET", Endpoint, true);
            _.forEach(Headers, function(value, key) {
                console.log("Set " + key + " to " + value);
                HttpRequest.setRequestHeader(key,value);
            });
            HttpRequest.send(null);
        }
}

function getDataFromURL(request) {
    //Param to the class 
    var Client = new HttpClient();
    var method;
    var error;
    
    //Iterate on endpoints array
    _.forEach(request.endpoints, function(object) {
        Client.get(object.endpoint, function (answer) {
            var res = JSON.parse(answer);
            if(res.status==="success"){
                //Save response on db
                method = {action:"update",param:{doc:res.data,key_id:object.key_id}};
                pouchDB(method);    
            }else{
                //Handle error from endpoint
                error = {error:res, endpoint:object.endpoint};
                postMessage(error);
            }
        });
    });  
}

function pouchDB(method) {
    if(method.action === "ini"){
        var database = method.param.database;
         //Get or Create database 
        db = new PouchDB(database);
        
        //Events on DB
        db.changes({since: 'now', live: true, include_docs: true})
          .on('change',function(change) {
            console.log(change);
            postMessage({status:"success",key:change.id});
          })
          .on('complete', function(info) {
            console.log(info);
          })
          .on('error', function(err) {
            console.log(err);
            //postMessage({status:"fail",key:keyId});
          });   
          
     }else if(method.action === "update"){
         console.log("Save doc: ",method.param.doc);
         console.log("With Key: ",method.param.key_id);
         
         var keyId = method.param.key_id;
         var document = method.param.doc;
         
         //Update or Insert document
         db.get(keyId).then(function(doc) {
             document._rev = doc._rev;
             document._id = keyId;
             return db.put(document);
         }).then(function(response) {
             console.log("Get/Put Response from PouchDB: ",response);
             //postMessage({status:"success",key:keyId});
         }).catch(function (err) {
             console.log("Get Error from PouchDB: ",err);
             if (err.status === 404) {
                document._id = keyId;
                return db.put(document);
             }else{
                 throw err;
             }
         }).then(function(response) {
             console.log("Put Response from PouchDB: ",response);
            //  if(response)
            //     postMessage({status:"success",key:keyId});
         }).catch(function (err) {
             console.log("Put Error from PouchDB: ",err);
             postMessage({status:"fail",key:keyId});
         });
     }
}

//Interval for Queued Calls        
setInterval(function(){ 
    var message = {message: "to_refresh_data"};
    self.postMessage(message); 
}, 300000);