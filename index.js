const { app, dialog } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const PouchDB = require('pouchdb')

app.on('ready', () => {
  let addTask = doc => {
    let options = {
      properties: ['openDirectory']
    }
    let filePaths = dialog.showOpenDialog(options)
    doc.tasks.push(
      /*
      {
        type: 'child_process',
        name: '',
        command: null,
        args: [
          filePaths[0]
        ]
      }
      */
      {
        type: 'electron',
        path: filePaths[0]
      }
    )
    db.put(doc).then(response => {
      console.log(response)
    })
    return db.get('config').then(doc => {
      return doc
    })
  }
  let userData = app.getPath('userData')
  let db = new PouchDB(path.join(userData, 'db'))
  db.get('config').then(doc => {
    if (doc.tasks.length <= 0) {
      return addTask(doc)
    }
    return doc
  }).catch(err => {
    if (err.status !== 404) {
      throw err
    }
    return addTask({
      _id: 'config',
      tasks: []
    })
  }).then(doc => {
    let subprocesses = []
    for (let task of doc.tasks) {
      switch (task.type) {
        case 'child_process':
          break
        case 'electron':
          let exe = app.getPath('exe')
          let subprocess = spawn(exe, [task.path])
          subprocess.stdout.on('data', chunk => {
            console.log(`${task.type}: stdout: ${chunk}`)
          })
          subprocess.stderr.on('data', chunk => {
            console.log(`${task.type}: stderr: ${chunk}`)
          })
          subprocess.on('close', code => {
            console.log(`${task.type}: ${task.path}: ${code}`)
            if (code !== 0) {
              doc.tasks = doc.tasks.filter(element => element !== task)
              db.put(doc).then(response => {
                console.log(response)
              })
            }
            subprocesses = subprocesses.filter(element => element !== subprocess)
            if (subprocesses.length <= 0) {
              app.quit()
            }
          })
          subprocesses.push(subprocess)
          break
        default:
          dialog.showErrorBox('Unknown type', JSON.stringify(task, null, '  '))
      }
    }
  }).catch(reason => {
    console.log(reason)
    dialog.showErrorBox(reason.name, reason.message)
    app.exit(1)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
