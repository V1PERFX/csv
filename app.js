const $ = (sel) => document.querySelector(sel)

const els = {
  input: $('#input-file'),
  fileName: $('#file-name'),
  fileStats: $('#file-stats'),
  search: $('#search'),
  newFile: $('#new-file'),
  sample: $('#sample-btn'),
  themeToggle: $('#theme-toggle'),
  toast: $('#toast'),
  table: $('#handsontable-container'),
  empty: $('#empty'),
}

let hot = null
let rows = []
let fields = []

/* ---------------------------------------------- theme */

const THEME_KEY = 'csv-viewer-theme'

els.themeToggle.onclick = function () {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  try { localStorage.setItem(THEME_KEY, next) } catch (e) { /* private mode */ }
  hot && hot.render()
}

/* ---------------------------------------------- toast */

let toastTimer = null

function toast(message, isError) {
  els.toast.textContent = message
  els.toast.classList.toggle('error', !!isError)
  els.toast.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200)
}

/* ---------------------------------------------- parsing */

function handleFile(file) {
  if (!file) return

  if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
    toast('That does not look like a CSV file.', true)
    return
  }

  const reader = new FileReader()

  reader.onerror = () => toast('Could not read that file.', true)
  reader.onload = (e) => render(e.target.result, file.name)

  reader.readAsText(file)
}

function render(csv, name) {
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true })

  fields = parsed.meta.fields || []
  rows = parsed.data || []

  if (!fields.length || !rows.length) {
    toast('This CSV seems to be empty.', true)
    return
  }

  els.fileName.textContent = name
  els.search.value = ''
  els.empty.hidden = true // a stale "no matches" overlay would hide the new data
  document.body.classList.add('has-data')

  hot && hot.destroy()
  hot = new Handsontable(els.table, {
    data: rows,
    columns: fields.map((field) => (
      isNumericColumn(field)
        ? { data: field, className: 'htRight num-cell' }
        : { data: field }
    )),
    colHeaders: fields,
    rowHeaders: true,
    columnSorting: true,
    manualColumnResize: true,
    readOnly: true,
    width: '100%',
    height: '100%',
    rowHeights: 34,
    stretchH: fields.length <= 8 ? 'all' : 'last',
    licenseKey: 'non-commercial-and-evaluation',
  })

  updateStats(rows.length)
}

// right-align columns that hold only numbers, so digits line up
function isNumericColumn(field) {
  let seen = 0

  for (let i = 0; i < rows.length && seen < 40; i++) {
    const value = rows[i][field]
    if (value == null || value === '') continue

    seen++
    if (!/^[-+]?[\d.,]+%?$/.test(String(value).trim())) return false
  }

  return seen > 0
}

function updateStats(shown) {
  const total = rows.length
  const count = shown === total
    ? `${total.toLocaleString()} rows`
    : `${shown.toLocaleString()} of ${total.toLocaleString()} rows`

  els.fileStats.textContent = `${count} · ${fields.length} columns`
}

/* ---------------------------------------------- search */

let searchTimer = null

els.search.oninput = function () {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => applySearch(this.value.trim().toLowerCase()), 140)
}

function applySearch(term) {
  if (!hot) return

  const matches = term
    ? rows.filter((row) => fields.some((f) => String(row[f] ?? '').toLowerCase().includes(term)))
    : rows

  hot.updateData(matches)
  updateStats(matches.length)
  els.empty.hidden = matches.length > 0
}

/* ---------------------------------------------- file pickers */

els.input.onchange = function () {
  handleFile(this.files[0])
  this.value = '' // allow re-picking the same file
}

els.newFile.onclick = function () {
  document.body.classList.remove('has-data')
  els.empty.hidden = true
  els.search.value = ''

  if (hot) {
    hot.destroy()
    hot = null
  }

  rows = []
  fields = []
}

/* ---------------------------------------------- drag & drop */

let dragDepth = 0

window.addEventListener('dragenter', (e) => {
  e.preventDefault()
  dragDepth++
  document.body.classList.add('is-dragging')
})

window.addEventListener('dragover', (e) => e.preventDefault())

window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1)
  if (!dragDepth) document.body.classList.remove('is-dragging')
})

window.addEventListener('drop', (e) => {
  e.preventDefault()
  dragDepth = 0
  document.body.classList.remove('is-dragging')
  handleFile(e.dataTransfer.files[0])
})

/* ---------------------------------------------- sample data */

const SAMPLE = `Product,Category,Region,Units,Revenue,Growth
Aurora Keyboard,Hardware,North America,1284,192600,12.4
Aurora Keyboard,Hardware,Europe,932,139800,8.1
Nimbus Mouse,Hardware,North America,2410,96400,-2.3
Nimbus Mouse,Hardware,Asia Pacific,3187,127480,21.7
Atlas Monitor,Hardware,Europe,644,257600,5.9
Atlas Monitor,Hardware,Latin America,211,84400,33.2
Beacon Analytics,Software,North America,1890,378000,18.6
Beacon Analytics,Software,Europe,1422,284400,14.9
Beacon Analytics,Software,Asia Pacific,978,195600,27.3
Cinder Backup,Software,North America,3204,160200,-5.4
Cinder Backup,Software,Europe,2761,138050,1.2
Harbor CRM,Software,Asia Pacific,540,216000,41.8
Harbor CRM,Software,Latin America,168,67200,52.1
Lumen Support,Services,North America,742,222600,9.7
Lumen Support,Services,Europe,689,206700,6.3
Lumen Support,Services,Asia Pacific,431,129300,16.4
Onsite Training,Services,North America,96,144000,-11.2
Onsite Training,Services,Europe,74,111000,3.8`

els.sample.onclick = () => render(SAMPLE, 'sample-sales.csv')
