main=require '../index.js'

it "should be able to run simple scripts",(done)->
  main.run
    application:(args)->
      console.log "instance of an application is being ran"
  ,done
