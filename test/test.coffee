main=require '../index.js'
cluster={}

after (done)->
  cluster.shutDownServer(0)  # this is how you can terminate server permanently. Workers will receive cmd:terminate
  # cluster has cluster.shutDownServer cluster.shutDownAllWorker cluster.restartAllWorker cluster.eachWorker

  setTimeout(done,2000)

it "should be able to run simple scripts",(done)->
  main.run
    application:(args)->
      console.log "instance of an application is being ran"
    setting:
      motd:true    # setting for displaying motd, default true
      checkMaster:true    # whether worker watch for master termination
      threads:4    # how many threads to run, default 16
      limit:4      # how many threads spawn parallel, default 4
  ,(e,o)->
    # o.workers contains an array of all workers
    # o.masterpid contains master pid
    # o,cluster contains cluster
    cluster=o.cluster
    console.log "All done!"
    console.log "Found "+o.workers.length+" workers"
    console.log ""
    setTimeout ()->
      o.workers[0].send({cmd:"terminate"})  # this is how you can terminate a worker permanently, if exited any other way, the worker thread will automatically recover by restarting
      setTimeout ()->
        done(e)
      ,1000
    ,1000
