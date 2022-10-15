import crawler from './crawler.js'

const global = getLocalStore('bson.editor.global')

global.content  = null
global.isValid  = false
global.editMode = false

const contentWindow = document.querySelector('.content-window')
const contentView   = contentWindow.querySelector('.content-view')
const editorView    = contentWindow.querySelector('.editor-view')
const viewEditBtn   = document.querySelector('.action-menu #edit')

refreshEditorMode()

viewEditBtn.addEventListener('click', () => {
  global.editMode = !global.editMode
  refreshEditorMode()
})

setInterval(() => {
  localStorage.setItem('bson.editor.global', JSON.stringify(global))
  .catch(err => console.error('Failed to save bson.editor.global:', err))
}, 5000)

function refreshEditorMode() {
  const content = localStorage.getItem('editorContent')
  if (global.editMode) {
    contentView.classList.add('hide')
    editorView.classList.remove('hide')
    viewEditBtn.textContent = 'Edit Mode'
    editorView.textContent = content
  } else {
    contentView.classList.remove('hide')
    editorView.classList.add('hide')
    viewEditBtn.textContent = 'View Mode'
    const jsonTree = createDoc(content)
    contentView.appendChild(jsonTree)
    console.log(contentView)
  }
}

function getLocalStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key))
  } catch(err) {
    console.error('Failed to fetch data from store:', key, err)
    return new Object()
  }
}

function createDoc(json) {
  return crawler('root', JSON.parse(json), null, 0)
}

editorView.addEventListener('input', (e) => {
  try {
    const content = JSON.parse(editorView.textContent)
    global.content = content
    global.isValid = true
    editorView.style.backgroundColor = 'rgba(0, 128, 0, 0.1)'
    localStorage.setItem('editorContent', editorView.textContent)
  } catch(err) {
    global.content = null
    global.isValid = false
    editorView.style.backgroundColor = 'rgba(128, 0, 0, 0.1)'
  }
})

