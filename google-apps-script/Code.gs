/** Homepage-only order store. Deploy bound to the dedicated private spreadsheet. */
const CJENG_HEADERS = ['년도','수주번호','수주일자','준공예정일','상태','담당자','수주처','공사현장','공사명','비고','내부ID','이전 수주처'];
const CJENG_FIELDS = ['year','orderNo','orderDate','expectedCompletionDate','status','manager','client1','region','projectName','note','id','client2'];

function setupWorkspace() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!sheet) throw new Error('공용 수주대장 시트의 확장 프로그램 → Apps Script에서 실행하세요.');
  const props = PropertiesService.getScriptProperties();
  props.setProperty('CJENG_SPREADSHEET_ID', sheet.getId());
  if (!props.getProperty('CJENG_API_SECRET')) props.setProperty('CJENG_API_SECRET', Utilities.getUuid() + Utilities.getUuid());
  console.log('초기 설정 완료. 프로젝트 설정의 스크립트 속성 CJENG_API_SECRET을 Vercel의 WORKSPACE_SHEETS_SECRET에 설정하세요.');
}

function doGet() { return cjengJson_({ok:false,error:'직원 홈페이지에서 이용하세요.'}); }

function doPost(event) {
  let lock, locked = false;
  try {
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('CJENG_API_SECRET');
    const id = props.getProperty('CJENG_SPREADSHEET_ID');
    if (!secret || secret.length < 32 || !id) throw new Error('not configured');
    const raw = event && event.postData && event.postData.contents;
    if (!raw || raw.length > 2000000) throw new Error('invalid request');
    const envelope = JSON.parse(raw);
    if (typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string') throw new Error('invalid request');
    const expected = cjengHex_(Utilities.computeHmacSha256Signature(envelope.payload, secret, Utilities.Charset.UTF_8));
    if (!cjengEqual_(envelope.signature, expected)) throw new Error('unauthorized');
    const body = JSON.parse(envelope.payload);
    if (!Number.isFinite(body.issuedAt) || Math.abs(Date.now() - body.issuedAt) > 60000 || !/^[0-9a-f-]{36}$/i.test(body.nonce)) throw new Error('expired');
    if (body.action !== 'read' && body.action !== 'write') throw new Error('invalid action');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) throw new Error('busy');
    locked = true;
    const cache = CacheService.getScriptCache();
    if (cache.get(body.nonce)) throw new Error('replayed request');
    cache.put(body.nonce, '1', 120);
    const workbook = SpreadsheetApp.openById(id);
    const sheet = workbook.getSheetByName('수주대장');
    if (!sheet || sheet.getLastRow() > 10001) throw new Error('invalid sheet');
    const header = sheet.getRange(1,1,1,12).getDisplayValues()[0];
    if (JSON.stringify(header) !== JSON.stringify(CJENG_HEADERS)) throw new Error('invalid headers');
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2,1,sheet.getLastRow()-1,12).getDisplayValues().filter(row => row.some(String)) : [];
    const revision = cjengRevision_(rows);
    if (body.action === 'read') return cjengJson_({ok:true,data:cjengSnapshot_(rows, revision)});
    const input = body.data;
    if (!input || typeof input.revision !== 'string' || input.revision !== revision) return cjengJson_({ok:false,conflict:true});
    const next = cjengValidate_(input.orders);
    const count = Math.max(next.length, rows.length);
    if (count) {
      if (sheet.getMaxRows() < count + 1) sheet.insertRowsAfter(sheet.getMaxRows(), count + 1 - sheet.getMaxRows());
      const writeRows = next.map(row => row.map(value => /^[=+\-@]/.test(value) ? "'" + value : value));
      while (writeRows.length < count) writeRows.push(Array(12).fill(''));
      sheet.getRange(2,1,count,12).setValues(writeRows);
      SpreadsheetApp.flush();
    }
    return cjengJson_({ok:true,data:cjengSnapshot_(next,cjengRevision_(next))});
  } catch (_) {
    return cjengJson_({ok:false,error:'공유 수주대장 요청을 처리하지 못했습니다.'});
  } finally { if (locked) lock.releaseLock(); }
}

function cjengValidate_(orders) {
  if (!Array.isArray(orders) || orders.length > 10000) throw new Error('invalid orders');
  const ids = new Set(), keys = new Set();
  return orders.map(order => {
    if (!order || typeof order !== 'object') throw new Error('invalid order');
    const row = CJENG_FIELDS.map(field => {
      const value = order[field] === undefined ? '' : order[field];
      if (typeof value !== 'string' || value.length > (field === 'note' ? 10000 : 2000)) throw new Error('invalid field');
      return value;
    });
    const key = row[0] + '/' + row[1].trim();
    if (!/^\d{4}$/.test(row[0]) || !row[1].trim() || !row[8].trim() || !row[10].trim() || ids.has(row[10]) || keys.has(key)) throw new Error('invalid identity');
    if (row[4] && !['예정','진행중','보류','준공','취소'].includes(row[4])) throw new Error('invalid status');
    ids.add(row[10]); keys.add(key);
    return row;
  });
}

function cjengSnapshot_(rows, revision) {
  return {revision:revision,orders:rows.map(row => {
    const order = {client2:''};
    CJENG_FIELDS.forEach((field,index) => {order[field] = String(row[index] || '');});
    return order;
  })};
}

function cjengRevision_(rows) {
  return cjengHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(rows), Utilities.Charset.UTF_8));
}
function cjengHex_(bytes) { return bytes.map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join(''); }
function cjengEqual_(left,right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i=0;i<left.length;i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}
function cjengJson_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }
