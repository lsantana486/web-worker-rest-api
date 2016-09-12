importScripts('lodash.min.js');
importScripts('lz-string.min.js');

//Event Listener for message from the main thread
this.onmessage = function (e) {
    //console.log('OnMessage Data: ',e);
    
    //Variable to handle the request from main thread
    var requestWorker = e.data;
    if(requestWorker.hasOwnProperty('config')){
        //Interval for Queued Calls        
        setInterval(function(){ 
            var message = {message: 'from_queue'};
            self.postMessage(message); 
        }, requestWorker.config.timer);

    }else if(requestWorker.hasOwnProperty('lz_string')){  
        lzString(requestWorker.lz_string);

    }else{
        getDataFromURL(requestWorker);
    }
}

//Class object to handle HTTP requests
var HttpClient = function () {
    this.send = function (Endpoint, Callback) {
        var HttpRequest = new XMLHttpRequest();
        HttpRequest.onreadystatechange = function () {
            if (HttpRequest.readyState == 4 && HttpRequest.status == 200) {
                //console.log("Worker - Http Response: ",HttpRequest.responseText);
                Callback(HttpRequest.responseText);
            
            }else if(HttpRequest.readyState == 4 && HttpRequest.status == 503){
                Callback('{\"status\":\"error\", \"message\":\"Backend Unavailable\"}');
        
            }else if(HttpRequest.readyState == 4 && HttpRequest.status == 0){
                Callback('{\"status\":\"error\", \"message\":\"Backend Unavailable\"}');
            }              
        }        
        
        HttpRequest.open(Endpoint.method, Endpoint.url, true);
            _.forEach(Endpoint.headers, function(value, key) {
                //console.log('Set '+ key + ' to ' + value);
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
            if(res.status==='success'){
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

function lzString(request) {
    var message = {message: 'storage'};
    if(request.method === 'compress'){
        request.result = request.value;//LZString.compress(JSON.stringify(request.value));
    }
    message.data = request;
    postMessage(message);
}
