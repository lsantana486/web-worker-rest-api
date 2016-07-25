importScripts('../lodash/dist/lodash.js');

//Global variable for database
var Headers;

//Event Listener for message from the main thread
this.onmessage = function (e) {
    console.log('OnMessage Data: ',e);
    
    //Variable to handle the request from main thread
    var requestWorker = e.data;
     
    if(requestWorker.hasOwnProperty("config")){
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
                //Response
                postMessage({to_db:{doc:res.data,key_id:object.key_id}});
            }else{
                //Handle error from endpoint
                error = {error:res, endpoint:object.endpoint};
                postMessage(error);
            }
        });
    });  
}

//Interval for Queued Calls        
setInterval(function(){ 
    var message = {message: "to_refresh_data"};
    self.postMessage(message); 
}, 300000);
