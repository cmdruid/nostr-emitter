const rules = {
  'version': [],
  'vin': [],
  'txid': [],
  'prevout': [],
  'scriptSig': [],
  'sequence': [],
  'txWitness': [],
  'vout': [],
  'value': [],
  'scriptPubkey': [],
  'locktime':[],
}

export default function crawler(key, value, parent, depth) {

  const [ node, childNode ] = createNode(key, value, depth)

  if (typeof(value) === "object") {
    if (Array.isArray(value)) {
      value.forEach((val, idx) => {
        crawler(idx, val, childNode, depth + 1)
      })
    }
    else {
      Object.entries(value).forEach(([key, val]) => {
        crawler(key, val, childNode, depth + 1)
      })
    }
  } 
  
  if (parent) {
    // If a parent node exists, append 
    // the current node as a child.
    parent.appendChild(node)
  } else {
    // Configure the current node as
    // root and return it.
    node.classList.remove('row')
    node.classList.add('root')
    node.setAttribute('id', 'root')
    return node
  }
}

function createNode(key, value, depth) {
  // Construct a node element.
  const rowElem = document.createElement('div'),
        childEl = document.createElement('div'),
        itmElem = document.createElement('div'),
        keyElem = document.createElement('div'),
        colElem = document.createElement('div'),
        valElem = document.createElement('div'),
        keyTag  = document.createElement('span'),
        valTag  = document.createElement('span')

  // Classify the key as an index or key object.
  if (typeof(key) === 'number') {
    keyElem.classList.add('index')
  } else { 
    keyElem.classList.add('key')
  }
  
  // Add key to the content of the key tag.
  keyTag.textContent = String(key)
  
  // Configure separator element.
  colElem.classList.add('separator')
  colElem.textContent = ':'

  // Configure element based on value.
  const valType = typeof(value)
  if (valType === 'object') {
    if (Array.isArray(value)) {
      rowElem.classList.add('array')
      valElem.classList.add('array')
      if (!value.length) {
        rowElem.classList.add('empty')
      }
    } else {
      valElem.classList.add('object')
      rowElem.classList.add('object')
    }
  } else {
    valElem.classList.add(valType)
    valTag.textContent = value
    rowElem.setAttribute('data-value', value)
  }

  valElem.classList.add('value')
  itmElem.classList.add('item')
  childEl.classList.add('children')
  rowElem.classList.add('row')

  rowElem.setAttribute('data-depth', depth)
  rowElem.setAttribute('data-key', key)
  childEl.style.marginLeft = (depth * 0.5) + 'em'

  keyElem.appendChild(keyTag)
  valElem.appendChild(valTag)
  itmElem.appendChild(keyElem)
  itmElem.appendChild(colElem)
  itmElem.appendChild(valElem)
  rowElem.appendChild(itmElem)
  rowElem.appendChild(childEl)

  return [ rowElem, childEl ]
}
