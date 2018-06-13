main=require('./index.js')
main.run({application:function(args){
    console.log("instance of an application is being ran")
}},function(e,o){
    if(e)
        console.log(e);
    console.log("All Done!");
    console.log("shutting down server.");
    o.cluster.shutDownServer(0)
});