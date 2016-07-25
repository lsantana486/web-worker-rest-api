importScripts('../lodash/dist/lodash.js');

//Event Listener for message from the main thread
this.onmessage = function (e) {
    console.log('OnMessage Data: ',e);
    
    //Variable to handle the request from main thread
    var requestWorker = e.data;
    getDataFromURL(requestWorker);
    
}

//Class object to handle HTTP requests
var HttpClient = function () {
    this.send = function (Endpoint, Callback) {
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
        
        HttpRequest.open(Endpoint.method, Endpoint.url, true);
            _.forEach(Endpoint.headers, function(value, key) {
                console.log("Set " + key + " to " + value);
                HttpRequest.setRequestHeader(key,value);
            });

        HttpRequest.send(JSON.stringify(Endpoint.data));
    }
}

function getDataFromURL(request) {
    //Param to the class 
    var Client = new HttpClient();
    var success;
    var error;
    
    //Iterate on endpoints array
    _.forEach(request, function(object) {
        Client.send(object, function (response) {
            var res = JSON.parse(response);
            if(res.status==="success"){
                //Response
                success = {success:res, endpoint:object};
                postMessage(success);

            }else{
                //Handle error from endpoint
                error = {error:res, endpoint:object};
                postMessage(error);
            }
        });
    });  
}

//Interval for Queued Calls        
setInterval(function(){ 
    var message = {message: "from_queue"};
    self.postMessage(message); 
}, 30000);
