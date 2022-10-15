console.log('BTON loaded!')

const global = window.global = {
  content: null,
  isValid: false
}

const actions = {
  'new': ''
}

const infoField  = document.querySelector('.info')
const actionMenu = document.querySelectorAll('.action-menu')

// for (let elem of actionMenu) {
//   elem.addEventListener('click', (e) => {
//     const action = e.target.textContent.toLowerCase()
    

//     actions[action](content)
//   })
// }


window.parent.dispatchEvent(
  new CustomEvent('resizeFrame', { 
    detail: document.documentElement.scrollHeight + 30 + 'px' 
  })
)

function createNewTx() {
  const newTx = {
    'version': 1,
    'vin': [],
    'vout': [],
    'locktime': 0
  }
}
