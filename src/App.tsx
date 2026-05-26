import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './App.css'
import {
  orderVendorContacts,
  purchaseVendorContacts,
  type VendorContact,
} from './vendorData'

type Order = {
  id: string
  year?: string
  orderNo: string
  orderDate: string
  expectedCompletionDate: string
  manager: string
  client1: string
  client2: string
  region: string
  projectName: string
}

type Expense = {
  id: string
  projectId: string
  date: string
  kind: '카드' | '세금계산서'
  vendor: string
  category: string
  memo: string
  amount: number
}

type WorkLog = {
  id: string
  projectId: string
  date: string
  worker: string
  workerType: '직원' | '인력'
  startTime: string
  endTime: string
  overtimeHours: number
  location: string
  task: string
  note: string
  hours: number
}

type WorkLogWorkerInput = {
  worker: string
  workerType: WorkLog['workerType']
}

type PurchaseOrder = {
  id: string
  projectId: string
  orderDate: string
  vendor: string
  item: string
  quantity: string
  amount: number
  status: '요청' | '발주완료' | '입고완료'
}

type View =
  | 'orders'
  | 'project'
  | 'dashboard'
  | 'expenses'
  | 'worklogs'
  | 'contacts'
type ProjectDetailTab = 'worklogs' | 'expenses' | 'purchases'
type ContactTab = 'purchase' | 'order'
type SortDirection = 'asc' | 'desc'
type VendorSearchScope = 'all' | 'company' | 'contact' | 'item'
type VendorSortKey =
  | 'company'
  | 'contact'
  | 'mobile'
  | 'tel'
  | 'fax'
  | 'email'
  | 'address'
  | 'item'
type OrderSortKey =
  | 'year'
  | 'orderNo'
  | 'orderDate'
  | 'expectedCompletionDate'
  | 'manager'
  | 'client1'
  | 'client2'
  | 'region'
  | 'projectName'
type ExpenseSortKey =
  | 'date'
  | 'kind'
  | 'vendor'
  | 'category'
  | 'memo'
  | 'amount'
type WorkLogSortKey =
  | 'date'
  | 'worker'
  | 'workerType'
  | 'startTime'
  | 'endTime'
  | 'overtimeHours'
  | 'location'
  | 'task'
  | 'note'
  | 'hours'
type ProjectSortKey =
  | 'orderNo'
  | 'projectName'
  | 'client1'
  | 'region'
  | 'status'
  | 'cost'
  | 'manDays'
  | 'purchaseAmount'
type PurchaseOrderSortKey =
  | 'orderDate'
  | 'vendor'
  | 'item'
  | 'quantity'
  | 'status'
  | 'amount'

const emptyVendorContact: VendorContact = {
  company: '',
  contact: '',
  mobile: '',
  tel: '',
  fax: '',
  email: '',
  address: '',
  item: '',
}

const defaultOrders: Order[] = [
  {
    id: 'o-2025-001',
    orderNo: '2025-001',
    orderDate: '2025-01-14',
    expectedCompletionDate: '2025-03-28',
    manager: '김현수',
    client1: '태광산업',
    client2: '환경안전팀',
    region: '경기 안산',
    projectName: '흡착탑 교체 및 배관 보수공사',
  },
  {
    id: 'o-2025-002',
    orderNo: '2025-002',
    orderDate: '2025-02-03',
    expectedCompletionDate: '2025-04-15',
    manager: '박민재',
    client1: '동림화학',
    client2: '공무팀',
    region: '충남 천안',
    projectName: '폐수처리장 약품탱크 증설공사',
  },
  {
    id: 'o-2025-003',
    orderNo: '2025-003',
    orderDate: '2025-03-21',
    expectedCompletionDate: '2025-05-30',
    manager: '이준호',
    client1: '세림금속',
    client2: '설비보전팀',
    region: '인천 남동',
    projectName: '집진기 덕트라인 개선공사',
  },
  {
    id: 'o-2025-004',
    orderNo: '2025-004',
    orderDate: '2025-06-10',
    expectedCompletionDate: '2025-08-22',
    manager: '최유진',
    client1: '한빛산업',
    client2: '생산기술팀',
    region: '경기 화성',
    projectName: '스크러버 순환펌프 교체공사',
  },
  {
    id: 'o-2025-005',
    orderNo: '2025-005',
    orderDate: '2025-09-02',
    expectedCompletionDate: '2025-11-18',
    manager: '정도윤',
    client1: '우진바이오',
    client2: '시설관리팀',
    region: '충북 청주',
    projectName: '악취방지시설 후드 설치공사',
  },
  {
    id: 'o-2026-001',
    orderNo: '2026-001',
    orderDate: '2026-01-09',
    expectedCompletionDate: '2026-02-27',
    manager: '김현수',
    client1: '한빛산업',
    client2: '환경안전팀',
    region: '경기 화성',
    projectName: '대기방지시설 개선공사',
  },
  {
    id: 'o-2026-002',
    orderNo: '2026-002',
    orderDate: '2026-02-16',
    expectedCompletionDate: '2026-04-24',
    manager: '박민재',
    client1: '동서화학',
    client2: '공무팀',
    region: '울산 남구',
    projectName: '폐수처리장 배관 교체',
  },
  {
    id: 'o-2026-003',
    orderNo: '2026-003',
    orderDate: '2026-03-05',
    expectedCompletionDate: '2026-05-29',
    manager: '이준호',
    client1: '세림금속',
    client2: '설비보전팀',
    region: '인천 서구',
    projectName: '집진설비 신규 설치',
  },
  {
    id: 'o-2026-004',
    orderNo: '2026-004',
    orderDate: '2026-04-18',
    expectedCompletionDate: '2026-07-10',
    manager: '최유진',
    client1: '대영제지',
    client2: '안전환경팀',
    region: '전북 군산',
    projectName: 'RTO 전처리 필터박스 보강공사',
  },
  {
    id: 'o-2026-005',
    orderNo: '2026-005',
    orderDate: '2026-05-11',
    expectedCompletionDate: '2026-08-21',
    manager: '정도윤',
    client1: '우진바이오',
    client2: '시설관리팀',
    region: '충북 청주',
    projectName: '폐수 유량조정조 방수 보수공사',
  },
]

const defaultExpenses: Expense[] = [
  {
    id: 'e-001',
    projectId: 'o-2026-001',
    date: '2026-05-13',
    kind: '카드',
    vendor: '대성철물',
    category: '자재비',
    memo: '덕트 보강 자재',
    amount: 1280000,
  },
  {
    id: 'e-002',
    projectId: 'o-2026-001',
    date: '2026-05-17',
    kind: '세금계산서',
    vendor: '태영렌탈',
    category: '장비대',
    memo: '고소작업대 2일',
    amount: 740000,
  },
  {
    id: 'e-003',
    projectId: 'o-2026-002',
    date: '2026-05-18',
    kind: '카드',
    vendor: '우리배관',
    category: '자재비',
    memo: 'SUS 배관 및 밸브',
    amount: 2165000,
  },
  {
    id: 'e-004',
    projectId: 'o-2026-003',
    date: '2026-05-20',
    kind: '세금계산서',
    vendor: '세명환경기계',
    category: '외주비',
    memo: '집진기 본체 제작',
    amount: 12600000,
  },
  {
    id: 'e-005',
    projectId: 'o-2025-004',
    date: '2025-07-02',
    kind: '카드',
    vendor: '한성펌프',
    category: '자재비',
    memo: '순환펌프 부품',
    amount: 980000,
  },
]

const defaultWorkLogs: WorkLog[] = [
  {
    id: 'w-001',
    projectId: 'o-2026-001',
    date: '2026-05-14',
    worker: '김현수',
    workerType: '직원',
    startTime: '08:00',
    endTime: '17:00',
    overtimeHours: 0,
    location: '집진기실',
    task: '기존 설비 철거 및 덕트 보강',
    note: '안전난간 설치 후 작업',
    hours: 8,
  },
  {
    id: 'w-002',
    projectId: 'o-2026-001',
    date: '2026-05-15',
    worker: '박민재',
    workerType: '직원',
    startTime: '08:00',
    endTime: '16:00',
    overtimeHours: 0,
    location: '송풍기 기초부',
    task: '송풍기 베이스 설치',
    note: '',
    hours: 7,
  },
  {
    id: 'w-003',
    projectId: 'o-2026-002',
    date: '2026-05-19',
    worker: '이준호',
    workerType: '인력',
    startTime: '08:00',
    endTime: '17:30',
    overtimeHours: 0.5,
    location: '폐수처리장 1층',
    task: '배관 절단 및 플랜지 용접',
    note: '용접 화기감시 배치',
    hours: 8.5,
  },
  {
    id: 'w-004',
    projectId: 'o-2026-003',
    date: '2026-05-21',
    worker: '최유진',
    workerType: '직원',
    startTime: '08:30',
    endTime: '17:30',
    overtimeHours: 0,
    location: '집진설비 설치구역',
    task: '집진기 하부 프레임 설치',
    note: '',
    hours: 8,
  },
  {
    id: 'w-005',
    projectId: 'o-2025-004',
    date: '2025-07-08',
    worker: '정도윤',
    workerType: '인력',
    startTime: '09:00',
    endTime: '16:30',
    overtimeHours: 0,
    location: '스크러버실',
    task: '스크러버 순환펌프 교체',
    note: '시운전 완료',
    hours: 6.5,
  },
]

const purchaseOrders: PurchaseOrder[] = [
  {
    id: 'po-001',
    projectId: 'o-2026-001',
    orderDate: '2026-05-10',
    vendor: '세명환경기계',
    item: '덕트 보강 플랜지 및 브라켓',
    quantity: '1식',
    amount: 1850000,
    status: '입고완료',
  },
  {
    id: 'po-002',
    projectId: 'o-2026-001',
    orderDate: '2026-05-12',
    vendor: '태영렌탈',
    item: '고소작업대 임대',
    quantity: '2일',
    amount: 740000,
    status: '발주완료',
  },
  {
    id: 'po-003',
    projectId: 'o-2026-002',
    orderDate: '2026-05-15',
    vendor: '우리배관',
    item: 'SUS 배관, 밸브, 플랜지',
    quantity: '1식',
    amount: 2580000,
    status: '입고완료',
  },
  {
    id: 'po-004',
    projectId: 'o-2026-003',
    orderDate: '2026-05-18',
    vendor: '세명환경기계',
    item: '집진기 본체 및 하부 호퍼',
    quantity: '1대',
    amount: 12600000,
    status: '발주완료',
  },
  {
    id: 'po-005',
    projectId: 'o-2026-004',
    orderDate: '2026-05-02',
    vendor: '대영필터',
    item: '전처리 필터박스 제작',
    quantity: '2대',
    amount: 5400000,
    status: '요청',
  },
]

const formatDateOnly = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`

const formatMonthOnly = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const formatMoney = (value: number) =>
  new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value)

const today = formatDateOnly(new Date())
const currentYear = today.slice(0, 4)
const defaultProjectId = defaultOrders[5].id

function getOrderYear(order: Order) {
  if (order.year) return order.year
  if (order.orderDate) return order.orderDate.slice(0, 4)

  const yyOrderNo = order.orderNo.match(/^(\d{2})\d+$/)
  if (yyOrderNo) return `20${yyOrderNo[1]}`

  return order.orderNo.match(/^\d{4}/)?.[0] ?? '기타'
}

function getNextOrderNo(year: string, orders: Order[]) {
  const prefix = year.slice(-2)
  const maxSequence = orders
    .filter((order) => getOrderYear(order) === year)
    .map((order) => {
      const yyMatch = order.orderNo.match(new RegExp(`^${prefix}(\\d+)$`))
      const yyyyMatch = order.orderNo.match(new RegExp(`^${year}-(\\d+)$`))
      return Number(yyMatch?.[1] ?? yyyyMatch?.[1] ?? 0)
    })
    .reduce((max, sequence) => Math.max(max, sequence), 0)

  return `${prefix}${String(maxSequence + 1).padStart(3, '0')}`
}

function getMonthDays(monthText: string) {
  const [year, month] = monthText.split('-').map(Number)
  const firstDate = new Date(year, month - 1, 1)
  const lastDate = new Date(year, month, 0)
  const leadingDays = firstDate.getDay()
  const days: Array<{ date: string; isCurrentMonth: boolean }> = []

  for (let index = leadingDays - 1; index >= 0; index -= 1) {
    const date = new Date(year, month - 1, -index)
    days.push({
      date: formatDateOnly(date),
      isCurrentMonth: false,
    })
  }

  for (let day = 1; day <= lastDate.getDate(); day += 1) {
    const date = new Date(year, month - 1, day)
    days.push({
      date: formatDateOnly(date),
      isCurrentMonth: true,
    })
  }

  while (days.length % 7 !== 0) {
    const date = new Date(year, month - 1, lastDate.getDate() + days.length)
    days.push({
      date: formatDateOnly(date),
      isCurrentMonth: false,
    })
  }

  return days
}

function moveMonth(monthText: string, amount: number) {
  const [year, month] = monthText.split('-').map(Number)
  const date = new Date(year, month - 1 + amount, 1)

  return formatMonthOnly(date)
}

const createWorkerInput = (): WorkLogWorkerInput => ({
  worker: '',
  workerType: '직원',
})

function calculateWorkHours(
  startTime: string,
  endTime: string,
  overtimeHours: number,
) {
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  const start = startHour * 60 + startMinute
  const end = endHour * 60 + endMinute
  const regularHours = Math.max(0, (end - start) / 60 - 1)

  return Number((regularHours + overtimeHours).toFixed(2))
}

function loadStoredData<T>(key: string, fallback: T): T {
  const stored = localStorage.getItem(key)
  if (!stored) return fallback

  try {
    return JSON.parse(stored) as T
  } catch {
    return fallback
  }
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, '')
}

function compareText(a: string | number, b: string | number) {
  return String(a).localeCompare(String(b), 'ko-KR', {
    numeric: true,
    sensitivity: 'base',
  })
}

function getSortDirectionLabel(
  active: boolean,
  direction: SortDirection,
) {
  if (!active) return ''

  return direction === 'asc' ? ' ↑' : ' ↓'
}

function getProjectStatus(order: Order) {
  if (order.expectedCompletionDate < today) return '준공'
  if (order.orderDate > today) return '예정'
  return '진행중'
}

function App() {
  const [view, setView] = useState<View>('orders')
  const [orderYear, setOrderYear] = useState(currentYear)
  const [orders, setOrders] = useState(() =>
    loadStoredData('cost-app-orders', defaultOrders),
  )
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [orderSort, setOrderSort] = useState<{
    key: OrderSortKey
    direction: SortDirection
  }>({ key: 'orderNo', direction: 'asc' })
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId)
  const [projectDetailTab, setProjectDetailTab] =
    useState<ProjectDetailTab>('worklogs')
  const [contactTab, setContactTab] = useState<ContactTab>('purchase')
  const [selectedVendorKeys, setSelectedVendorKeys] = useState<string[]>([])
  const [vendorSearchScope, setVendorSearchScope] =
    useState<VendorSearchScope>('all')
  const [vendorSearchText, setVendorSearchText] = useState('')
  const [vendorSort, setVendorSort] = useState<{
    key: VendorSortKey
    direction: SortDirection
  }>({ key: 'company', direction: 'asc' })
  const [inactiveVendorKeys, setInactiveVendorKeys] = useState<string[]>(() =>
    loadStoredData('cost-app-inactive-vendors', []),
  )
  const [deletedVendorKeys, setDeletedVendorKeys] = useState<string[]>(() =>
    loadStoredData('cost-app-deleted-vendors', []),
  )
  const [vendorEdits, setVendorEdits] = useState<Record<string, VendorContact>>(
    () => loadStoredData<Record<string, VendorContact>>('cost-app-vendor-edits', {}),
  )
  const [editingVendorKey, setEditingVendorKey] = useState<string | null>(null)
  const [vendorForm, setVendorForm] =
    useState<VendorContact>(emptyVendorContact)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false)
  const [expenses, setExpenses] = useState(() =>
    loadStoredData('cost-app-expenses', defaultExpenses),
  )
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([])
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [expenseSort, setExpenseSort] = useState<{
    key: ExpenseSortKey
    direction: SortDirection
  }>({ key: 'date', direction: 'desc' })
  const [workLogMonth, setWorkLogMonth] = useState(today.slice(0, 7))
  const [workLogSort, setWorkLogSort] = useState<{
    key: WorkLogSortKey
    direction: SortDirection
  }>({ key: 'date', direction: 'desc' })
  const [selectedCalendarWork, setSelectedCalendarWork] = useState<{
    date: string
    projectId: string
  } | null>(null)
  const [projectSort, setProjectSort] = useState<{
    key: ProjectSortKey
    direction: SortDirection
  }>({ key: 'orderNo', direction: 'asc' })
  const [purchaseOrderSort, setPurchaseOrderSort] = useState<{
    key: PurchaseOrderSortKey
    direction: SortDirection
  }>({ key: 'orderDate', direction: 'desc' })
  const [workLogs, setWorkLogs] = useState(() =>
    loadStoredData('cost-app-worklogs-v2', defaultWorkLogs),
  )
  const [expenseForm, setExpenseForm] = useState({
    projectId: defaultProjectId,
    date: today,
    kind: '카드' as Expense['kind'],
    vendor: '',
    category: '자재비',
    memo: '',
    amount: '',
  })
  const [workLogForm, setWorkLogForm] = useState({
    projectId: defaultProjectId,
    date: today,
    workerCount: '1',
    startTime: '07:30',
    endTime: '16:30',
    overtimeHours: '0',
    location: '',
    task: '',
    note: '',
    workers: [createWorkerInput()],
  })
  const [orderForm, setOrderForm] = useState({
    year: '2026',
    orderNo: '26006',
    orderDate: today,
    expectedCompletionDate: today,
    manager: '',
    client1: '',
    client2: '',
    region: '',
    projectName: '',
  })

  useEffect(() => {
    localStorage.setItem('cost-app-expenses', JSON.stringify(expenses))
  }, [expenses])

  useEffect(() => {
    localStorage.setItem('cost-app-orders', JSON.stringify(orders))
  }, [orders])

  useEffect(() => {
    localStorage.setItem('cost-app-worklogs-v2', JSON.stringify(workLogs))
  }, [workLogs])

  useEffect(() => {
    localStorage.setItem(
      'cost-app-inactive-vendors',
      JSON.stringify(inactiveVendorKeys),
    )
  }, [inactiveVendorKeys])

  useEffect(() => {
    localStorage.setItem(
      'cost-app-deleted-vendors',
      JSON.stringify(deletedVendorKeys),
    )
  }, [deletedVendorKeys])

  useEffect(() => {
    localStorage.setItem('cost-app-vendor-edits', JSON.stringify(vendorEdits))
  }, [vendorEdits])

  const projectSummaries = useMemo(
    () =>
      orders.map((order) => {
        const year = getOrderYear(order)
        const projectExpenses = expenses.filter(
          (expense) => expense.projectId === order.id,
        )
        const projectWorkLogs = workLogs.filter(
          (workLog) => workLog.projectId === order.id,
        )
        const projectPurchaseOrders = purchaseOrders.filter(
          (purchaseOrder) => purchaseOrder.projectId === order.id,
        )
        const cost = projectExpenses.reduce(
          (total, expense) => total + expense.amount,
          0,
        )
        const hours = projectWorkLogs.reduce(
          (total, workLog) => total + workLog.hours,
          0,
        )
        const purchaseAmount = projectPurchaseOrders.reduce(
          (total, purchaseOrder) => total + purchaseOrder.amount,
          0,
        )

        return {
          ...order,
          year,
          cost,
          hours,
          manDays: hours / 8,
          purchaseAmount,
          status: getProjectStatus(order),
          records:
            projectExpenses.length +
            projectWorkLogs.length +
            projectPurchaseOrders.length,
        }
      }),
    [expenses, orders, workLogs],
  )

  const orderYears = useMemo(
    () =>
      [...new Set([...orders.map((order) => getOrderYear(order)), orderYear])]
        .filter(Boolean)
        .sort((a, b) => compareText(a, b)),
    [orderYear, orders],
  )
  const filteredOrders = [...orders]
    .filter((order) => getOrderYear(order) === orderYear)
    .sort((a, b) => {
      const aValue = orderSort.key === 'year' ? getOrderYear(a) : a[orderSort.key]
      const bValue = orderSort.key === 'year' ? getOrderYear(b) : b[orderSort.key]
      const result = compareText(aValue ?? '', bValue ?? '')

      return orderSort.direction === 'asc' ? result : -result
    })
  const yearlyProjectSummaries = [...projectSummaries]
    .filter((project) => getOrderYear(project) === orderYear)
    .sort((a, b) => {
      const aValue = a[projectSort.key]
      const bValue = b[projectSort.key]
      const result =
        typeof aValue === 'number' && typeof bValue === 'number'
          ? aValue - bValue
          : compareText(aValue, bValue)

      return projectSort.direction === 'asc' ? result : -result
    })
  const selectedProject = projectSummaries.find(
    (project) => project.id === selectedProjectId,
  )
  const filteredExpenses = [...expenses]
    .filter((expense) => expense.projectId === selectedProjectId)
    .sort((a, b) => {
      const aValue =
        expenseSort.key === 'amount' ? a.amount : String(a[expenseSort.key])
      const bValue =
        expenseSort.key === 'amount' ? b.amount : String(b[expenseSort.key])
      const result =
        expenseSort.key === 'amount'
          ? Number(aValue) - Number(bValue)
          : compareText(aValue, bValue)

      return expenseSort.direction === 'asc' ? result : -result
    })
  const filteredWorkLogs = [...workLogs]
    .filter((workLog) => workLog.projectId === selectedProjectId)
    .sort((a, b) => {
      const aValue = a[workLogSort.key]
      const bValue = b[workLogSort.key]
      const result =
        typeof aValue === 'number' && typeof bValue === 'number'
          ? aValue - bValue
          : compareText(aValue, bValue)

      return workLogSort.direction === 'asc' ? result : -result
    })
  const filteredPurchaseOrders = [...purchaseOrders]
    .filter((purchaseOrder) => purchaseOrder.projectId === selectedProjectId)
    .sort((a, b) => {
      const aValue = a[purchaseOrderSort.key]
      const bValue = b[purchaseOrderSort.key]
      const result =
        typeof aValue === 'number' && typeof bValue === 'number'
          ? aValue - bValue
          : compareText(aValue, bValue)

      return purchaseOrderSort.direction === 'asc' ? result : -result
    })
  const totalCost = projectSummaries.reduce(
    (total, project) => total + project.cost,
    0,
  )
  const totalHours = projectSummaries.reduce(
    (total, project) => total + project.hours,
    0,
  )
  const calendarDays = getMonthDays(workLogMonth)
  const calendarWorkLogs = workLogs.filter((workLog) =>
    workLog.date.startsWith(workLogMonth),
  )
  const selectedCalendarWorkLogs = selectedCalendarWork
    ? [...workLogs]
        .filter(
          (workLog) =>
            workLog.date === selectedCalendarWork.date &&
            workLog.projectId === selectedCalendarWork.projectId,
        )
        .sort((a, b) => {
          const aValue = a[workLogSort.key]
          const bValue = b[workLogSort.key]
          const result =
            typeof aValue === 'number' && typeof bValue === 'number'
              ? aValue - bValue
              : compareText(aValue, bValue)

          return workLogSort.direction === 'asc' ? result : -result
        })
    : []
  const selectedCalendarProject = selectedCalendarWork
    ? projectSummaries.find(
        (project) => project.id === selectedCalendarWork.projectId,
      )
    : undefined
  const activeVendorContacts =
    contactTab === 'purchase' ? purchaseVendorContacts : orderVendorContacts
  const vendorSearchQuery = normalizeSearchText(vendorSearchText)
  const vendorRows = activeVendorContacts
    .map((contact, index) => {
      const key = getVendorContactKey(contact, index)

      return {
        contact: vendorEdits[key] ?? contact,
        key,
      }
    })
    .filter((vendor) => !deletedVendorKeys.includes(vendor.key))
    .filter(({ contact }) => {
      if (!vendorSearchQuery) return true

      const fields =
        vendorSearchScope === 'all'
          ? [
              contact.company,
              contact.contact,
              contact.mobile,
              contact.tel,
              contact.fax,
              contact.email,
              contact.address,
              contact.item,
            ]
          : [contact[vendorSearchScope]]

      return fields.some((field) =>
        normalizeSearchText(field).includes(vendorSearchQuery),
      )
    })
    .sort((a, b) => {
      const result = compareText(
        a.contact[vendorSort.key],
        b.contact[vendorSort.key],
      )

      return vendorSort.direction === 'asc' ? result : -result
    })
  const selectedVendorCount = selectedVendorKeys.length
  const allVendorsSelected =
    vendorRows.length > 0 &&
    vendorRows.every((vendor) => selectedVendorKeys.includes(vendor.key))
  const selectedOrderCount = selectedOrderIds.length
  const allOrdersSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((order) => selectedOrderIds.includes(order.id))
  const selectedExpenseCount = selectedExpenseIds.length
  const allExpensesSelected =
    filteredExpenses.length > 0 &&
    filteredExpenses.every((expense) => selectedExpenseIds.includes(expense.id))

  function getVendorContactKey(contact: VendorContact, index: number) {
    return [
      contactTab,
      contact.company,
      contact.contact,
      contact.tel,
      contact.mobile,
      index,
    ].join('|')
  }

  function toggleSelectedVendor(vendorKey: string) {
    setSelectedVendorKeys((current) =>
      current.includes(vendorKey)
        ? current.filter((key) => key !== vendorKey)
        : [...current, vendorKey],
    )
  }

  function updateVendorSort(key: VendorSortKey) {
    setVendorSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  function updateOrderSort(key: OrderSortKey) {
    setOrderSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  function selectProject(projectId: string) {
    setSelectedProjectId(projectId)
    setExpenseForm((current) => ({ ...current, projectId }))
    setWorkLogForm((current) => ({ ...current, projectId }))
  }

  function switchOrderYear(nextYear: string) {
    setOrderYear(nextYear)
    setSelectedOrderIds([])
    const firstProject = orders.find((order) => getOrderYear(order) === nextYear)
    if (firstProject) {
      selectProject(firstProject.id)
    }
  }

  function jumpToWorkLogDate(date: string) {
    if (!date) return

    setWorkLogMonth(date.slice(0, 7))
    setWorkLogForm((current) => ({
      ...current,
      date,
    }))
  }

  function updateExpenseSort(key: ExpenseSortKey) {
    setExpenseSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  function updateWorkLogSort(key: WorkLogSortKey) {
    setWorkLogSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  function updateProjectSort(key: ProjectSortKey) {
    setProjectSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  function updatePurchaseOrderSort(key: PurchaseOrderSortKey) {
    setPurchaseOrderSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  function switchContactTab(nextTab: ContactTab) {
    setContactTab(nextTab)
    setSelectedVendorKeys([])
    setEditingVendorKey(null)
    if (nextTab === 'order' && vendorSearchScope === 'item') {
      setVendorSearchScope('all')
    }
  }

  function toggleAllVendors() {
    setSelectedVendorKeys(
      allVendorsSelected ? [] : vendorRows.map((vendor) => vendor.key),
    )
  }

  function toggleSelectedOrder(orderId: string) {
    setSelectedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    )
  }

  function toggleAllOrders() {
    setSelectedOrderIds(
      allOrdersSelected ? [] : filteredOrders.map((order) => order.id),
    )
  }

  function toggleSelectedExpense(expenseId: string) {
    setSelectedExpenseIds((current) =>
      current.includes(expenseId)
        ? current.filter((id) => id !== expenseId)
        : [...current, expenseId],
    )
  }

  function toggleAllExpenses() {
    setSelectedExpenseIds(
      allExpensesSelected
        ? []
        : filteredExpenses.map((expense) => expense.id),
    )
  }

  function renderVendorSortButton(key: VendorSortKey, label: string) {
    return (
      <button
        className="sort-button"
        type="button"
        onClick={() => updateVendorSort(key)}
      >
        {label}
        {getSortDirectionLabel(vendorSort.key === key, vendorSort.direction)}
      </button>
    )
  }

  function renderOrderSortButton(key: OrderSortKey, label: string) {
    return (
      <button
        className="sort-button"
        type="button"
        onClick={() => updateOrderSort(key)}
      >
        {label}
        {getSortDirectionLabel(orderSort.key === key, orderSort.direction)}
      </button>
    )
  }

  function renderExpenseSortButton(key: ExpenseSortKey, label: string) {
    return (
      <button
        className="sort-button"
        type="button"
        onClick={() => updateExpenseSort(key)}
      >
        {label}
        {getSortDirectionLabel(expenseSort.key === key, expenseSort.direction)}
      </button>
    )
  }

  function renderWorkLogSortButton(key: WorkLogSortKey, label: string) {
    return (
      <button
        className="sort-button"
        type="button"
        onClick={() => updateWorkLogSort(key)}
      >
        {label}
        {getSortDirectionLabel(workLogSort.key === key, workLogSort.direction)}
      </button>
    )
  }

  function renderProjectSortButton(key: ProjectSortKey, label: string) {
    return (
      <button
        className="sort-button"
        type="button"
        onClick={() => updateProjectSort(key)}
      >
        {label}
        {getSortDirectionLabel(projectSort.key === key, projectSort.direction)}
      </button>
    )
  }

  function renderPurchaseOrderSortButton(
    key: PurchaseOrderSortKey,
    label: string,
  ) {
    return (
      <button
        className="sort-button"
        type="button"
        onClick={() => updatePurchaseOrderSort(key)}
      >
        {label}
        {getSortDirectionLabel(
          purchaseOrderSort.key === key,
          purchaseOrderSort.direction,
        )}
      </button>
    )
  }

  function openVendorEditor() {
    const vendor = vendorRows.find((row) => row.key === selectedVendorKeys[0])

    if (!vendor || selectedVendorKeys.length !== 1) return

    setVendorForm(vendor.contact)
    setEditingVendorKey(vendor.key)
  }

  function saveVendorEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editingVendorKey) return

    setVendorEdits((current) => ({
      ...current,
      [editingVendorKey]: vendorForm,
    }))
    setEditingVendorKey(null)
  }

  function deleteSelectedVendors() {
    if (selectedVendorKeys.length === 0) return

    const canDelete = window.confirm(
      `선택한 거래처 ${selectedVendorKeys.length}건을 삭제할까요?`,
    )
    if (!canDelete) return

    setDeletedVendorKeys((current) => [
      ...new Set([...current, ...selectedVendorKeys]),
    ])
    setInactiveVendorKeys((current) =>
      current.filter((key) => !selectedVendorKeys.includes(key)),
    )
    setVendorEdits((current) => {
      const next = { ...current }
      selectedVendorKeys.forEach((key) => {
        delete next[key]
      })
      return next
    })
    setSelectedVendorKeys([])
  }

  function toggleSelectedVendorsInactive() {
    if (selectedVendorKeys.length === 0) return

    const shouldRestore = selectedVendorKeys.every((key) =>
      inactiveVendorKeys.includes(key),
    )

    setInactiveVendorKeys((current) =>
      shouldRestore
        ? current.filter((key) => !selectedVendorKeys.includes(key))
        : [...new Set([...current, ...selectedVendorKeys])],
    )
  }

  function openProject(projectId: string) {
    selectProject(projectId)
    setProjectDetailTab('worklogs')
    setView('project')
  }

  function openNewOrderModal() {
    setEditingOrderId(null)
    setOrderForm({
      year: orderYear === '기타' ? new Date().getFullYear().toString() : orderYear,
      orderNo: getNextOrderNo(
        orderYear === '기타' ? new Date().getFullYear().toString() : orderYear,
        orders,
      ),
      orderDate: today,
      expectedCompletionDate: today,
      manager: '',
      client1: '',
      client2: '',
      region: '',
      projectName: '',
    })
    setIsOrderModalOpen(true)
  }

  function closeOrderModal() {
    setEditingOrderId(null)
    setIsOrderModalOpen(false)
  }

  function openOrderEditor() {
    const order = orders.find((item) => item.id === selectedOrderIds[0])

    if (!order || selectedOrderIds.length !== 1) return

    setEditingOrderId(order.id)
    setOrderForm({
      year: getOrderYear(order),
      orderNo: order.orderNo,
      orderDate: order.orderDate,
      expectedCompletionDate: order.expectedCompletionDate,
      manager: order.manager,
      client1: order.client1,
      client2: order.client2,
      region: order.region,
      projectName: order.projectName,
    })
    setIsOrderModalOpen(true)
  }

  function deleteSelectedOrders() {
    if (selectedOrderIds.length === 0) return

    const canDelete = window.confirm(
      `선택한 수주 ${selectedOrderIds.length}건을 삭제할까요?`,
    )
    if (!canDelete) return

    setOrders((current) => {
      const next = current.filter((order) => !selectedOrderIds.includes(order.id))
      if (!next.some((order) => order.id === selectedProjectId)) {
        setSelectedProjectId(next[0]?.id ?? defaultProjectId)
      }
      return next
    })
    setSelectedOrderIds([])
  }

  function addOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!orderForm.orderNo.trim() || !orderForm.projectName.trim()) return

    if (editingOrderId) {
      setOrders((current) =>
        current
          .map((order) =>
            order.id === editingOrderId
              ? {
                  ...order,
                  year: orderForm.year,
                  orderNo: orderForm.orderNo,
                  orderDate: orderForm.orderDate,
                  expectedCompletionDate: orderForm.expectedCompletionDate,
                  manager: orderForm.manager,
                  client1: orderForm.client1,
                  client2: orderForm.client2,
                  region: orderForm.region,
                  projectName: orderForm.projectName,
                }
              : order,
          )
          .sort((a, b) => a.orderNo.localeCompare(b.orderNo)),
      )
      setOrderYear(orderForm.year)
      setSelectedOrderIds([])
      setEditingOrderId(null)
      setIsOrderModalOpen(false)
      return
    }

    const newOrder: Order = {
      id: `o-${orderForm.orderNo}-${crypto.randomUUID()}`,
      year: orderForm.year,
      orderNo: orderForm.orderNo,
      orderDate: orderForm.orderDate,
      expectedCompletionDate: orderForm.expectedCompletionDate,
      manager: orderForm.manager,
      client1: orderForm.client1,
      client2: orderForm.client2,
      region: orderForm.region,
      projectName: orderForm.projectName,
    }

    setOrders((current) =>
      [...current, newOrder].sort((a, b) => a.orderNo.localeCompare(b.orderNo)),
    )
    setOrderYear(orderForm.year)
    setSelectedProjectId(newOrder.id)
    setExpenseForm((current) => ({ ...current, projectId: newOrder.id }))
    setWorkLogForm((current) => ({ ...current, projectId: newOrder.id }))
    setOrderForm((current) => ({
      ...current,
      orderNo: getNextOrderNo(current.year, [...orders, newOrder]),
      orderDate: today,
      expectedCompletionDate: today,
      manager: '',
      client1: '',
      client2: '',
      region: '',
      projectName: '',
    }))
    setIsOrderModalOpen(false)
    setView('orders')
  }

  function openExpenseEditor() {
    const expense = expenses.find((item) => item.id === selectedExpenseIds[0])

    if (!expense || selectedExpenseIds.length !== 1) return

    setEditingExpenseId(expense.id)
    setExpenseForm({
      projectId: expense.projectId,
      date: expense.date,
      kind: expense.kind,
      vendor: expense.vendor,
      category: expense.category,
      memo: expense.memo,
      amount: String(expense.amount),
    })
    setIsExpenseModalOpen(true)
  }

  function deleteSelectedExpenses() {
    if (selectedExpenseIds.length === 0) return

    const canDelete = window.confirm(
      `선택한 지출 ${selectedExpenseIds.length}건을 삭제할까요?`,
    )
    if (!canDelete) return

    setExpenses((current) =>
      current.filter((expense) => !selectedExpenseIds.includes(expense.id)),
    )
    setSelectedExpenseIds([])
    setEditingExpenseId(null)
  }

  function cancelExpenseEdit() {
    setEditingExpenseId(null)
    setIsExpenseModalOpen(false)
    setExpenseForm((current) => ({
      ...current,
      projectId: selectedProjectId,
      date: today,
      vendor: '',
      memo: '',
      amount: '',
    }))
  }

  function openNewExpenseModal() {
    setEditingExpenseId(null)
    setExpenseForm((current) => ({
      ...current,
      projectId: selectedProjectId,
      date: today,
      vendor: '',
      memo: '',
      amount: '',
    }))
    setIsExpenseModalOpen(true)
  }

  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = Number(expenseForm.amount)

    if (!expenseForm.vendor.trim() || !amount) return

    if (editingExpenseId) {
      setExpenses((current) =>
        current.map((expense) =>
          expense.id === editingExpenseId
            ? {
                ...expense,
                projectId: expenseForm.projectId,
                date: expenseForm.date,
                kind: expenseForm.kind,
                vendor: expenseForm.vendor,
                category: expenseForm.category,
                memo: expenseForm.memo,
                amount,
              }
            : expense,
        ),
      )
      setSelectedProjectId(expenseForm.projectId)
      setEditingExpenseId(null)
      setSelectedExpenseIds([])
      setExpenseForm((current) => ({
        ...current,
        vendor: '',
        memo: '',
        amount: '',
      }))
      setIsExpenseModalOpen(false)
      return
    }

    setExpenses((current) => [
      {
        id: crypto.randomUUID(),
        projectId: expenseForm.projectId,
        date: expenseForm.date,
        kind: expenseForm.kind,
        vendor: expenseForm.vendor,
        category: expenseForm.category,
        memo: expenseForm.memo,
        amount,
      },
      ...current,
    ])
    setSelectedProjectId(expenseForm.projectId)
    setExpenseForm((current) => ({
      ...current,
      vendor: '',
      memo: '',
      amount: '',
    }))
    setIsExpenseModalOpen(false)
  }

  function updateWorkerCount(countText: string) {
    const count = Math.max(1, Math.min(20, Number(countText) || 1))

    setWorkLogForm((current) => ({
      ...current,
      workerCount: String(count),
      workers: Array.from({ length: count }, (_, index) =>
        current.workers[index] ? current.workers[index] : createWorkerInput(),
      ),
    }))
  }

  function updateWorkerInput(
    index: number,
    field: keyof WorkLogWorkerInput,
    value: string,
  ) {
    setWorkLogForm((current) => ({
      ...current,
      workers: current.workers.map((worker, workerIndex) =>
        workerIndex === index ? { ...worker, [field]: value } : worker,
      ),
    }))
  }

  function addWorkLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const overtimeHours = Number(workLogForm.overtimeHours) || 0
    const hours = calculateWorkHours(
      workLogForm.startTime,
      workLogForm.endTime,
      overtimeHours,
    )
    const validWorkers = workLogForm.workers
      .map((worker) => ({ ...worker, hours }))
      .filter((worker) => worker.worker.trim() && worker.hours > 0)

    if (!workLogForm.task.trim() || validWorkers.length === 0) return

    const newWorkLogs: WorkLog[] = validWorkers.map((worker) => ({
      id: crypto.randomUUID(),
      projectId: workLogForm.projectId,
      date: workLogForm.date,
      worker: worker.worker,
      workerType: worker.workerType,
      startTime: workLogForm.startTime,
      endTime: workLogForm.endTime,
      overtimeHours,
      location: workLogForm.location,
      task: workLogForm.task,
      note: workLogForm.note,
      hours: worker.hours,
    }))

    setWorkLogs((current) => [...newWorkLogs, ...current])
    setSelectedProjectId(workLogForm.projectId)
    setWorkLogForm((current) => ({
      ...current,
      workerCount: '1',
      startTime: '07:30',
      endTime: '16:30',
      overtimeHours: '0',
      location: '',
      task: '',
      note: '',
      workers: [createWorkerInput()],
    }))
    setIsWorkLogModalOpen(false)
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">(주)창조이엔지</p>
          <h1>공사 관리 WEB</h1>
        </div>

        <nav className="nav-tabs" aria-label="주요 메뉴">
          <button
            className={view === 'orders' ? 'active' : ''}
            type="button"
            onClick={() => setView('orders')}
          >
            수주대장
          </button>
          <button
            className={view === 'dashboard' ? 'active' : ''}
            type="button"
            onClick={() => setView('dashboard')}
          >
            공사현황
          </button>
          <button
            className={view === 'expenses' ? 'active' : ''}
            type="button"
            onClick={() => setView('expenses')}
          >
            지출내역
          </button>
          <button
            className={view === 'worklogs' ? 'active' : ''}
            type="button"
            onClick={() => setView('worklogs')}
          >
            작업일보
          </button>
          <button
            className={view === 'contacts' ? 'active' : ''}
            type="button"
            onClick={() => setView('contacts')}
          >
            거래처내역
          </button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {view === 'orders'
                ? '수주대장'
                : view === 'project'
                  ? '공사 상세'
                  : view === 'contacts'
                    ? '거래처 내역'
                    : view === 'dashboard'
                      ? '공사현황'
                      : view === 'expenses'
                        ? '지출내역'
                        : '작업일보'}
            </p>
            <h2>
              {view === 'orders'
                ? `${orderYear}년 수주대장`
                : view === 'contacts'
                  ? '거래처 내역'
                  : view === 'dashboard'
                    ? `${orderYear}년 공사별 원가 현황`
                    : view === 'expenses'
                      ? `${orderYear}년 공사 내역`
                      : view === 'worklogs'
                        ? '작업일보 달력'
                        : selectedProject?.projectName}
            </h2>
          </div>
          <div className="topbar-actions">
            {view === 'contacts' ? (
              <>
                <span>물품구입처 {purchaseVendorContacts.length}건</span>
                <span>발주처 {orderVendorContacts.length}건</span>
              </>
            ) : view === 'orders' ||
              view === 'dashboard' ||
              view === 'expenses' ? (
              <div className="year-switch" aria-label="수주년도">
                {orderYears.map((year) => (
                  <button
                    className={orderYear === year ? 'active' : ''}
                    key={year}
                    type="button"
                    onClick={() => switchOrderYear(year)}
                  >
                    {year}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <span>{selectedProject?.orderNo}</span>
                <span>{selectedProject?.client1}</span>
                <span>{selectedProject?.region}</span>
              </>
            )}
          </div>
        </header>

        {view === 'orders' && (
          <section className="metric-grid" aria-label="전체 요약">
            <article>
              <span>수주대장</span>
              <strong>{orders.length}건</strong>
            </article>
            <article>
              <span>{orderYear}년 수주</span>
              <strong>{filteredOrders.length}건</strong>
            </article>
            <article>
              <span>전체 공사비</span>
              <strong>{formatMoney(totalCost)}</strong>
            </article>
            <article>
              <span>전체 공수</span>
              <strong>{(totalHours / 8).toFixed(2)}명</strong>
            </article>
          </section>
        )}

        {view === 'contacts' && (
          <section className="content-grid single">
            <div className="panel wide">
              <div className="panel-heading">
                <div>
                  <h3>거래처 내역</h3>
                  <span>물품구입처와 발주처 탭만 표시</span>
                </div>
                <div className="contact-tabs" aria-label="거래처 구분">
                  <button
                    className={contactTab === 'purchase' ? 'active' : ''}
                    type="button"
                    onClick={() => switchContactTab('purchase')}
                  >
                    물품구입처
                    <span>{purchaseVendorContacts.length}건</span>
                  </button>
                  <button
                    className={contactTab === 'order' ? 'active' : ''}
                    type="button"
                    onClick={() => switchContactTab('order')}
                  >
                    발주처
                    <span>{orderVendorContacts.length}건</span>
                  </button>
                </div>
              </div>

              <div className="table-toolbar">
                <label className="search-control">
                  <span>검색</span>
                  <select
                    value={vendorSearchScope}
                    onChange={(event) =>
                      setVendorSearchScope(
                        event.target.value as VendorSearchScope,
                      )
                    }
                  >
                    <option value="all">전체</option>
                    <option value="company">업체명</option>
                    <option value="contact">이름</option>
                    {contactTab === 'purchase' && (
                      <option value="item">취급품목</option>
                    )}
                  </select>
                  <input
                    value={vendorSearchText}
                    onChange={(event) => setVendorSearchText(event.target.value)}
                    placeholder="검색어 입력"
                  />
                </label>
                <span>
                  표시 {vendorRows.length}건 / 전체 {activeVendorContacts.length}
                  건
                </span>
              </div>

              <div className="contact-actions">
                <span>선택 {selectedVendorCount}건</span>
                <div>
                  <button
                    className="ghost-button"
                    disabled={selectedVendorCount !== 1}
                    type="button"
                    onClick={openVendorEditor}
                  >
                    수정
                  </button>
                  <button
                    className="ghost-button"
                    disabled={selectedVendorCount === 0}
                    type="button"
                    onClick={deleteSelectedVendors}
                  >
                    삭제
                  </button>
                  <button
                    className="primary-button compact-button"
                    disabled={selectedVendorCount === 0}
                    type="button"
                    onClick={toggleSelectedVendorsInactive}
                  >
                    미사용
                  </button>
                </div>
              </div>

              <div className="table-wrap contacts-scroll">
                <table className="contacts-table">
                  <thead>
                    <tr>
                      <th className="check-cell">
                        <label className="select-all-cell">
                          <input
                            aria-label="전체선택"
                            checked={allVendorsSelected}
                            type="checkbox"
                            onChange={toggleAllVendors}
                          />
                          <span>선택</span>
                        </label>
                      </th>
                      <th>{renderVendorSortButton('company', '업체명')}</th>
                      <th>{renderVendorSortButton('contact', '이름')}</th>
                      <th>{renderVendorSortButton('mobile', 'H.P')}</th>
                      <th>{renderVendorSortButton('tel', 'TEL')}</th>
                      <th>{renderVendorSortButton('fax', 'FAX')}</th>
                      <th>{renderVendorSortButton('email', 'E-Mail')}</th>
                      <th>{renderVendorSortButton('address', '주소')}</th>
                      {contactTab === 'purchase' && (
                        <th>{renderVendorSortButton('item', '취급품목')}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {vendorRows.map(({ contact, key: vendorKey }, index) => {
                      const isInactive = inactiveVendorKeys.includes(vendorKey)
                      const isSelected = selectedVendorKeys.includes(vendorKey)

                      return (
                        <tr
                          className={isInactive ? 'inactive-row' : ''}
                          key={vendorKey}
                        >
                          <td className="check-cell">
                            <input
                              aria-label={`선택 ${
                                contact.company || index + 1
                              }`}
                              checked={isSelected}
                              type="checkbox"
                              onChange={() => toggleSelectedVendor(vendorKey)}
                            />
                          </td>
                          <td>{contact.company || '-'}</td>
                          <td>{contact.contact || '-'}</td>
                          <td>{contact.mobile || '-'}</td>
                          <td>{contact.tel || '-'}</td>
                          <td>{contact.fax || '-'}</td>
                          <td>{contact.email || '-'}</td>
                          <td>{contact.address || '-'}</td>
                          {contactTab === 'purchase' && (
                            <td>{contact.item || '-'}</td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {editingVendorKey && (
                <div className="modal-backdrop" role="presentation">
                  <form
                    className="modal-panel form-panel"
                    onSubmit={saveVendorEdit}
                  >
                    <div className="modal-heading">
                      <div>
                        <h3>거래처 수정</h3>
                        <span>{vendorForm.company || '업체명 없음'}</span>
                      </div>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setEditingVendorKey(null)}
                      >
                        닫기
                      </button>
                    </div>

                    <div className="two-columns">
                      <label>
                        업체명
                        <input
                          value={vendorForm.company}
                          onChange={(event) =>
                            setVendorForm({
                              ...vendorForm,
                              company: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        이름
                        <input
                          value={vendorForm.contact}
                          onChange={(event) =>
                            setVendorForm({
                              ...vendorForm,
                              contact: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>

                    <div className="three-columns">
                      <label>
                        H.P
                        <input
                          value={vendorForm.mobile}
                          onChange={(event) =>
                            setVendorForm({
                              ...vendorForm,
                              mobile: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        TEL
                        <input
                          value={vendorForm.tel}
                          onChange={(event) =>
                            setVendorForm({
                              ...vendorForm,
                              tel: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        FAX
                        <input
                          value={vendorForm.fax}
                          onChange={(event) =>
                            setVendorForm({
                              ...vendorForm,
                              fax: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>

                    <label>
                      E-Mail
                      <input
                        value={vendorForm.email}
                        onChange={(event) =>
                          setVendorForm({
                            ...vendorForm,
                            email: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      주소
                      <input
                        value={vendorForm.address}
                        onChange={(event) =>
                          setVendorForm({
                            ...vendorForm,
                            address: event.target.value,
                          })
                        }
                      />
                    </label>
                    {contactTab === 'purchase' && (
                      <label>
                        취급품목
                        <input
                          value={vendorForm.item}
                          onChange={(event) =>
                            setVendorForm({
                              ...vendorForm,
                              item: event.target.value,
                            })
                          }
                        />
                      </label>
                    )}

                    <div className="modal-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setEditingVendorKey(null)}
                      >
                        취소
                      </button>
                      <button className="primary-button" type="submit">
                        저장
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </section>
        )}

        {view === 'orders' && (
          <section className="content-grid single">
            <div className="panel wide">
              <div className="panel-heading">
                <div>
                  <h3>수주대장</h3>
                  <span>공사명을 클릭하면 해당 공사 상세로 이동</span>
                </div>
                <button
                  className="primary-button"
                  type="button"
                  onClick={openNewOrderModal}
                >
                  수주 등록
                </button>
              </div>
              <div className="contact-actions">
                <span>선택 {selectedOrderCount}건</span>
                <div>
                  <button
                    className="ghost-button"
                    disabled={selectedOrderCount !== 1}
                    type="button"
                    onClick={openOrderEditor}
                  >
                    수정
                  </button>
                  <button
                    className="ghost-button"
                    disabled={selectedOrderCount === 0}
                    type="button"
                    onClick={deleteSelectedOrders}
                  >
                    삭제
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th className="check-cell">
                        <label className="select-all-cell">
                          <input
                            aria-label="수주 전체선택"
                            checked={allOrdersSelected}
                            type="checkbox"
                            onChange={toggleAllOrders}
                          />
                          <span>선택</span>
                        </label>
                      </th>
                      <th>{renderOrderSortButton('year', '년도')}</th>
                      <th>{renderOrderSortButton('orderNo', '수주번호')}</th>
                      <th>{renderOrderSortButton('orderDate', '수주일자')}</th>
                      <th>
                        {renderOrderSortButton(
                          'expectedCompletionDate',
                          '준공예정일',
                        )}
                      </th>
                      <th>{renderOrderSortButton('manager', '담당자')}</th>
                      <th>{renderOrderSortButton('client1', '수주처1')}</th>
                      <th>{renderOrderSortButton('client2', '수주처2')}</th>
                      <th>{renderOrderSortButton('region', '공사지역')}</th>
                      <th>{renderOrderSortButton('projectName', '공사명')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="check-cell">
                          <input
                            aria-label={`수주 선택 ${order.orderNo}`}
                            checked={selectedOrderIds.includes(order.id)}
                            type="checkbox"
                            onChange={() => toggleSelectedOrder(order.id)}
                          />
                        </td>
                        <td>{getOrderYear(order)}</td>
                        <td>{order.orderNo}</td>
                        <td>{order.orderDate}</td>
                        <td>{order.expectedCompletionDate}</td>
                        <td>{order.manager}</td>
                        <td>{order.client1}</td>
                        <td>{order.client2}</td>
                        <td>{order.region}</td>
                        <td>
                          <button
                            className="text-link"
                            type="button"
                            onClick={() => openProject(order.id)}
                          >
                            {order.projectName}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {isOrderModalOpen && (
          <div className="modal-backdrop" role="presentation">
            <form className="modal-panel form-panel" onSubmit={addOrder}>
              <div className="modal-heading">
                <div>
                  <h3>{editingOrderId ? '수주 수정' : '수주 등록'}</h3>
                  <span>
                    {editingOrderId
                      ? '선택한 수주 내용을 수정'
                      : '수주대장에 새 공사를 추가'}
                  </span>
                </div>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={closeOrderModal}
                >
                  닫기
                </button>
              </div>

              <div className="three-columns">
                <label>
                  년도
                  <input
                    maxLength={4}
                    value={orderForm.year}
                    onChange={(event) => {
                      const year = event.target.value
                      setOrderForm({
                        ...orderForm,
                        year,
                        orderNo:
                          editingOrderId || year.length !== 4
                            ? orderForm.orderNo
                            : getNextOrderNo(year, orders),
                      })
                    }}
                    placeholder="예: 2026"
                  />
                </label>
                <label>
                  수주번호
                  <input
                    value={orderForm.orderNo}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        orderNo: event.target.value,
                      })
                    }
                    placeholder="예: 26001"
                  />
                </label>
                <label>
                  수주일자
                  <input
                    type="date"
                    value={orderForm.orderDate}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        orderDate: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  준공예정일
                  <input
                    type="date"
                    value={orderForm.expectedCompletionDate}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        expectedCompletionDate: event.target.value,
                      })
                    }
                  />
                </label>
              </div>

              <div className="two-columns">
                <label>
                  담당자
                  <input
                    value={orderForm.manager}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        manager: event.target.value,
                      })
                    }
                    placeholder="예: 김현수"
                  />
                </label>
                <label>
                  공사지역
                  <input
                    value={orderForm.region}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        region: event.target.value,
                      })
                    }
                    placeholder="예: 경기 화성"
                  />
                </label>
              </div>

              <div className="two-columns">
                <label>
                  수주처1
                  <input
                    value={orderForm.client1}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        client1: event.target.value,
                      })
                    }
                    placeholder="예: 한빛산업"
                  />
                </label>
                <label>
                  수주처2
                  <input
                    value={orderForm.client2}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        client2: event.target.value,
                      })
                    }
                    placeholder="예: 환경안전팀"
                  />
                </label>
              </div>

              <label>
                공사명
                <input
                  value={orderForm.projectName}
                  onChange={(event) =>
                    setOrderForm({
                      ...orderForm,
                      projectName: event.target.value,
                    })
                  }
                  placeholder="예: 대기방지시설 개선공사"
                />
              </label>

              <div className="modal-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={closeOrderModal}
                >
                  취소
                </button>
                <button className="primary-button" type="submit">
                  {editingOrderId ? '수정 저장' : '수주 추가'}
                </button>
              </div>
            </form>
          </div>
        )}

        {view === 'project' && selectedProject && (
          <section className="detail-stack">
            <section className="project-hero">
              <div>
                <p className="eyebrow">공사 기본정보</p>
                <h3>{selectedProject.projectName}</h3>
              </div>
              <dl>
                <div>
                  <dt>수주번호</dt>
                  <dd>{selectedProject.orderNo}</dd>
                </div>
                <div>
                  <dt>담당자</dt>
                  <dd>{selectedProject.manager}</dd>
                </div>
                <div>
                  <dt>준공예정일</dt>
                  <dd>{selectedProject.expectedCompletionDate}</dd>
                </div>
                <div>
                  <dt>공사지역</dt>
                  <dd>{selectedProject.region}</dd>
                </div>
              </dl>
            </section>

            <section className="metric-grid project-metrics">
              <article>
                <span>작업시간</span>
                <strong>{selectedProject.hours.toFixed(1)}h</strong>
              </article>
              <article>
                <span>작업공수</span>
                <strong>{selectedProject.manDays.toFixed(2)}명</strong>
              </article>
              <article>
                <span>지출금액</span>
                <strong>{formatMoney(selectedProject.cost)}</strong>
              </article>
              <article>
                <span>발주금액</span>
                <strong>{formatMoney(selectedProject.purchaseAmount)}</strong>
              </article>
            </section>

            <section className="panel tab-panel">
              <div className="detail-tabs" aria-label="공사 상세 데이터">
                <button
                  className={projectDetailTab === 'worklogs' ? 'active' : ''}
                  type="button"
                  onClick={() => setProjectDetailTab('worklogs')}
                >
                  작업일보
                  <span>{selectedProject.manDays.toFixed(2)}명</span>
                </button>
                <button
                  className={projectDetailTab === 'expenses' ? 'active' : ''}
                  type="button"
                  onClick={() => setProjectDetailTab('expenses')}
                >
                  지출내역
                  <span>{formatMoney(selectedProject.cost)}</span>
                </button>
                <button
                  className={projectDetailTab === 'purchases' ? 'active' : ''}
                  type="button"
                  onClick={() => setProjectDetailTab('purchases')}
                >
                  발주내역
                  <span>{formatMoney(selectedProject.purchaseAmount)}</span>
                </button>
              </div>

              {projectDetailTab === 'worklogs' && (
                <>
                  <div className="panel-heading">
                    <h3>작업일보 및 작업공수</h3>
                    <span>작업시간을 8시간 기준 공수로 환산</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{renderWorkLogSortButton('date', '작업일')}</th>
                          <th>{renderWorkLogSortButton('worker', '작업자')}</th>
                          <th>{renderWorkLogSortButton('workerType', '구분')}</th>
                          <th>{renderWorkLogSortButton('startTime', '작업시작')}</th>
                          <th>{renderWorkLogSortButton('endTime', '작업종료')}</th>
                          <th>{renderWorkLogSortButton('overtimeHours', '잔업')}</th>
                          <th>{renderWorkLogSortButton('location', '작업장소')}</th>
                          <th>{renderWorkLogSortButton('task', '작업내용')}</th>
                          <th>{renderWorkLogSortButton('note', '비고')}</th>
                          <th>{renderWorkLogSortButton('hours', '작업시간')}</th>
                          <th>{renderWorkLogSortButton('hours', '공수')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWorkLogs.map((workLog) => (
                          <tr key={workLog.id}>
                            <td>{workLog.date}</td>
                            <td>{workLog.worker}</td>
                            <td>{workLog.workerType}</td>
                            <td>{workLog.startTime}</td>
                            <td>{workLog.endTime}</td>
                            <td>{workLog.overtimeHours.toFixed(1)}h</td>
                            <td>{workLog.location || '-'}</td>
                            <td>{workLog.task}</td>
                            <td>{workLog.note || '-'}</td>
                            <td>{workLog.hours.toFixed(1)}h</td>
                            <td>{(workLog.hours / 8).toFixed(2)}명</td>
                          </tr>
                        ))}
                        {filteredWorkLogs.length === 0 && (
                          <tr>
                            <td colSpan={11}>등록된 작업일보가 없습니다.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {projectDetailTab === 'expenses' && (
                <>
                  <div className="panel-heading">
                    <h3>공사비용 지출내역</h3>
                    <span>카드사용 및 세금계산서</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{renderExpenseSortButton('date', '사용일')}</th>
                          <th>{renderExpenseSortButton('kind', '구분')}</th>
                          <th>{renderExpenseSortButton('vendor', '거래처')}</th>
                          <th>{renderExpenseSortButton('category', '항목')}</th>
                          <th>{renderExpenseSortButton('memo', '메모')}</th>
                          <th>{renderExpenseSortButton('amount', '금액')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExpenses.map((expense) => (
                          <tr key={expense.id}>
                            <td>{expense.date}</td>
                            <td>{expense.kind}</td>
                            <td>{expense.vendor}</td>
                            <td>{expense.category}</td>
                            <td>{expense.memo || '-'}</td>
                            <td>{formatMoney(expense.amount)}</td>
                          </tr>
                        ))}
                        {filteredExpenses.length === 0 && (
                          <tr>
                            <td colSpan={6}>등록된 지출내역이 없습니다.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {projectDetailTab === 'purchases' && (
                <>
                  <div className="panel-heading">
                    <h3>발주 내역</h3>
                    <span>이 공사에 연결된 발주서 내용</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>
                            {renderPurchaseOrderSortButton('orderDate', '발주일')}
                          </th>
                          <th>{renderPurchaseOrderSortButton('vendor', '발주처')}</th>
                          <th>{renderPurchaseOrderSortButton('item', '품목')}</th>
                          <th>{renderPurchaseOrderSortButton('quantity', '수량')}</th>
                          <th>{renderPurchaseOrderSortButton('status', '상태')}</th>
                          <th>{renderPurchaseOrderSortButton('amount', '금액')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPurchaseOrders.map((purchaseOrder) => (
                          <tr key={purchaseOrder.id}>
                            <td>{purchaseOrder.orderDate}</td>
                            <td>{purchaseOrder.vendor}</td>
                            <td>{purchaseOrder.item}</td>
                            <td>{purchaseOrder.quantity}</td>
                            <td>
                              <span className="status">
                                {purchaseOrder.status}
                              </span>
                            </td>
                            <td>{formatMoney(purchaseOrder.amount)}</td>
                          </tr>
                        ))}
                        {filteredPurchaseOrders.length === 0 && (
                          <tr>
                            <td colSpan={6}>등록된 발주 내역이 없습니다.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </section>
        )}

        {view === 'dashboard' && (
          <section className="content-grid">
            <div className="panel wide">
              <div className="panel-heading">
                <h3>공사별 원가 현황</h3>
                <span>비용 + 작업 공수 + 발주 자동 집계</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{renderProjectSortButton('orderNo', '수주번호')}</th>
                      <th>{renderProjectSortButton('projectName', '공사명')}</th>
                      <th>{renderProjectSortButton('client1', '수주처')}</th>
                      <th>{renderProjectSortButton('region', '공사지역')}</th>
                      <th>{renderProjectSortButton('cost', '지출금액')}</th>
                      <th>{renderProjectSortButton('manDays', '작업공수')}</th>
                      <th>
                        {renderProjectSortButton('purchaseAmount', '발주금액')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyProjectSummaries.map((project) => (
                      <tr
                        className={
                          project.id === selectedProjectId ? 'selected-row' : ''
                        }
                        key={project.id}
                      >
                        <td>{project.orderNo}</td>
                        <td>
                          <button
                            className="text-link"
                            type="button"
                            onClick={() => selectProject(project.id)}
                          >
                            {project.projectName}
                          </button>
                        </td>
                        <td>{project.client1}</td>
                        <td>{project.region}</td>
                        <td>{formatMoney(project.cost)}</td>
                        <td>{project.manDays.toFixed(2)}명</td>
                        <td>{formatMoney(project.purchaseAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-heading">
                <h3>선택 공사 요약</h3>
                <span>{selectedProject?.orderNo}</span>
              </div>
              <dl className="summary-list">
                <div>
                  <dt>지출금액</dt>
                  <dd>{formatMoney(selectedProject?.cost ?? 0)}</dd>
                </div>
                <div>
                  <dt>작업시간</dt>
                  <dd>{(selectedProject?.hours ?? 0).toFixed(1)}h</dd>
                </div>
                <div>
                  <dt>환산 공수</dt>
                  <dd>{(selectedProject?.manDays ?? 0).toFixed(2)}명</dd>
                </div>
                <div>
                  <dt>발주금액</dt>
                  <dd>{formatMoney(selectedProject?.purchaseAmount ?? 0)}</dd>
                </div>
              </dl>
            </div>
          </section>
        )}

        {view === 'expenses' && (
          <section className="content-grid single">
            <div className="panel full">
              <div className="panel-heading">
                <h3>{orderYear}년 공사 내역</h3>
                <span>공사를 선택하면 지출내역이 표시됩니다</span>
              </div>
              <label className="project-select-control">
                공사 선택
                <select
                  value={selectedProjectId}
                  onChange={(event) => selectProject(event.target.value)}
                >
                  {yearlyProjectSummaries.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.orderNo} · {project.projectName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="panel full">
              <div className="panel-heading">
                <h3>선택 공사 지출내역</h3>
                <span>{formatMoney(selectedProject?.cost ?? 0)}</span>
              </div>
              <div className="contact-actions">
                <span>선택 {selectedExpenseCount}건</span>
                <div>
                  <button
                    className="primary-button compact-button"
                    type="button"
                    onClick={openNewExpenseModal}
                  >
                    지출 등록
                  </button>
                  <button
                    className="ghost-button"
                    disabled={selectedExpenseCount !== 1}
                    type="button"
                    onClick={openExpenseEditor}
                  >
                    수정
                  </button>
                  <button
                    className="ghost-button"
                    disabled={selectedExpenseCount === 0}
                    type="button"
                    onClick={deleteSelectedExpenses}
                  >
                    삭제
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="check-cell">
                        <label className="select-all-cell">
                          <input
                            aria-label="지출 전체선택"
                            checked={allExpensesSelected}
                            type="checkbox"
                            onChange={toggleAllExpenses}
                          />
                          <span>선택</span>
                        </label>
                      </th>
                      <th>{renderExpenseSortButton('date', '일자')}</th>
                      <th>{renderExpenseSortButton('kind', '구분')}</th>
                      <th>{renderExpenseSortButton('vendor', '거래처')}</th>
                      <th>{renderExpenseSortButton('category', '항목')}</th>
                      <th>{renderExpenseSortButton('memo', '메모')}</th>
                      <th>{renderExpenseSortButton('amount', '금액')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((expense) => (
                      <tr key={expense.id}>
                        <td className="check-cell">
                          <input
                            aria-label={`지출 선택 ${expense.vendor}`}
                            checked={selectedExpenseIds.includes(expense.id)}
                            type="checkbox"
                            onChange={() => toggleSelectedExpense(expense.id)}
                          />
                        </td>
                        <td>{expense.date}</td>
                        <td>{expense.kind}</td>
                        <td>{expense.vendor}</td>
                        <td>{expense.category}</td>
                        <td>{expense.memo || '-'}</td>
                        <td>{formatMoney(expense.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {isExpenseModalOpen && (
              <div className="modal-backdrop" role="presentation">
                <form className="modal-panel form-panel" onSubmit={addExpense}>
                  <div className="modal-heading">
                    <div>
                      <h3>{editingExpenseId ? '지출 수정' : '지출 등록'}</h3>
                      <span>카드사용 또는 세금계산서</span>
                    </div>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={cancelExpenseEdit}
                    >
                      닫기
                    </button>
                  </div>
                  <label>
                    공사
                    <select
                      value={expenseForm.projectId}
                      onChange={(event) =>
                        setExpenseForm({
                          ...expenseForm,
                          projectId: event.target.value,
                        })
                      }
                    >
                      {yearlyProjectSummaries.map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.orderNo} · {order.projectName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="two-columns">
                    <label>
                      사용일
                      <input
                        type="date"
                        value={expenseForm.date}
                        onChange={(event) =>
                          setExpenseForm({
                            ...expenseForm,
                            date: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      구분
                      <select
                        value={expenseForm.kind}
                        onChange={(event) =>
                          setExpenseForm({
                            ...expenseForm,
                            kind: event.target.value as Expense['kind'],
                          })
                        }
                      >
                        <option>카드</option>
                        <option>세금계산서</option>
                      </select>
                    </label>
                  </div>
                  <div className="two-columns">
                    <label>
                      거래처
                      <input
                        value={expenseForm.vendor}
                        onChange={(event) =>
                          setExpenseForm({
                            ...expenseForm,
                            vendor: event.target.value,
                          })
                        }
                        placeholder="예: 대성철물"
                      />
                    </label>
                    <label>
                      항목
                      <select
                        value={expenseForm.category}
                        onChange={(event) =>
                          setExpenseForm({
                            ...expenseForm,
                            category: event.target.value,
                          })
                        }
                      >
                        <option>자재비</option>
                        <option>장비대</option>
                        <option>외주비</option>
                        <option>식대</option>
                        <option>교통비</option>
                        <option>기타</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    금액
                    <input
                      min="0"
                      type="number"
                      value={expenseForm.amount}
                      onChange={(event) =>
                        setExpenseForm({
                          ...expenseForm,
                          amount: event.target.value,
                        })
                      }
                      placeholder="금액 입력"
                    />
                  </label>
                  <label>
                    메모
                    <input
                      value={expenseForm.memo}
                      onChange={(event) =>
                        setExpenseForm({
                          ...expenseForm,
                          memo: event.target.value,
                        })
                      }
                      placeholder="사용 목적"
                    />
                  </label>
                  <div className="modal-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={cancelExpenseEdit}
                    >
                      취소
                    </button>
                    <button className="primary-button" type="submit">
                      {editingExpenseId ? '수정 저장' : '지출 추가'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>
        )}

        {view === 'worklogs' && (
          <section className="content-grid single">
            <div className="panel worklog-toolbar">
              <div>
                <p className="eyebrow">작업일보</p>
                <h3>작업일보 등록 및 조회</h3>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={() => setIsWorkLogModalOpen(true)}
              >
                작업일보 추가
              </button>
            </div>

            <div className="panel calendar-panel">
              <div className="panel-heading">
                <div>
                  <h3>{workLogMonth} 작업 달력</h3>
                  <span>일자별 작업 공사와 작업자를 간략히 표시합니다</span>
                </div>
                <div className="calendar-actions">
                  <label className="date-jump-control">
                    일자 검색
                    <input
                      type="date"
                      value={workLogForm.date}
                      onChange={(event) => jumpToWorkLogDate(event.target.value)}
                      onInput={(event) =>
                        jumpToWorkLogDate(event.currentTarget.value)
                      }
                    />
                  </label>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setWorkLogMonth(moveMonth(workLogMonth, -1))}
                  >
                    이전
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setWorkLogMonth(today.slice(0, 7))}
                  >
                    오늘
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setWorkLogMonth(moveMonth(workLogMonth, 1))}
                  >
                    다음
                  </button>
                </div>
              </div>
              <div className="calendar-grid">
                {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                  <div className="calendar-weekday" key={day}>
                    {day}
                  </div>
                ))}
                {calendarDays.map((day) => {
                  const dayLogs = calendarWorkLogs.filter(
                    (workLog) => workLog.date === day.date,
                  )
                  const dayProjectGroups = Array.from(
                    dayLogs
                      .reduce((groups, workLog) => {
                        const current = groups.get(workLog.projectId) ?? []
                        groups.set(workLog.projectId, [...current, workLog])
                        return groups
                      }, new Map<string, WorkLog[]>())
                      .entries(),
                  ).map(([projectId, logs]) => ({
                    logs,
                    project: projectSummaries.find(
                      (project) => project.id === projectId,
                    ),
                    projectId,
                  }))

                  return (
                    <div
                      className={`calendar-day ${
                        day.isCurrentMonth ? '' : 'muted'
                      } ${day.date === today ? 'today' : ''}`}
                      key={day.date}
                    >
                      <button
                        className="calendar-date-button"
                        type="button"
                        onClick={() =>
                          setWorkLogForm((current) => ({
                            ...current,
                            date: day.date,
                          }))
                        }
                      >
                        {Number(day.date.slice(8, 10))}
                      </button>
                      <div>
                        {dayProjectGroups.slice(0, 3).map((group) => (
                          <button
                            className="calendar-entry"
                            key={`${day.date}-${group.projectId}`}
                            type="button"
                            onClick={() =>
                              setSelectedCalendarWork({
                                date: day.date,
                                projectId: group.projectId,
                              })
                            }
                          >
                            {group.project?.orderNo ?? '공사'} ·{' '}
                            {group.logs.length}명
                          </button>
                        ))}
                        {dayProjectGroups.length > 3 && (
                          <span className="calendar-more">
                            외 {dayProjectGroups.length - 3}건
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="panel full">
              <div className="panel-heading">
                <h3>공사 선택</h3>
                <span>{selectedProject?.projectName}</span>
              </div>
              <div className="project-year-switch" aria-label="작업일보 공사 년도">
                {orderYears.map((year) => (
                  <button
                    className={orderYear === year ? 'active' : ''}
                    key={year}
                    type="button"
                    onClick={() => switchOrderYear(year)}
                  >
                    {year}
                  </button>
                ))}
              </div>
              <label>
                공사
                <select
                  value={selectedProjectId}
                  onChange={(event) => selectProject(event.target.value)}
                >
                  {yearlyProjectSummaries.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.orderNo} · {project.projectName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedCalendarWork && (
              <div className="modal-backdrop" role="presentation">
                <div className="modal-panel small-modal">
                  <div className="modal-heading">
                    <div>
                      <h3>{selectedCalendarWork.date} 작업일보</h3>
                      <span>
                        {selectedCalendarProject?.orderNo} ·{' '}
                        {selectedCalendarProject?.projectName}
                      </span>
                    </div>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setSelectedCalendarWork(null)}
                    >
                      닫기
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{renderWorkLogSortButton('worker', '작업자')}</th>
                          <th>{renderWorkLogSortButton('workerType', '구분')}</th>
                          <th>{renderWorkLogSortButton('startTime', '시간')}</th>
                          <th>{renderWorkLogSortButton('location', '장소')}</th>
                          <th>{renderWorkLogSortButton('task', '작업내용')}</th>
                          <th>{renderWorkLogSortButton('note', '비고')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCalendarWorkLogs.map((workLog) => (
                          <tr key={workLog.id}>
                            <td>{workLog.worker}</td>
                            <td>{workLog.workerType}</td>
                            <td>
                              {workLog.startTime}-{workLog.endTime}
                              {workLog.overtimeHours > 0
                                ? ` / 잔업 ${workLog.overtimeHours}h`
                                : ''}
                            </td>
                            <td>{workLog.location || '-'}</td>
                            <td>{workLog.task}</td>
                            <td>{workLog.note || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {isWorkLogModalOpen && (
              <div className="modal-backdrop" role="presentation">
                <form className="modal-panel form-panel" onSubmit={addWorkLog}>
              <div className="modal-heading">
                <div>
                  <h3>작업일보 등록</h3>
                  <span>공통 작업정보를 한 번 입력하고 작업자만 추가</span>
                </div>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setIsWorkLogModalOpen(false)}
                >
                  닫기
                </button>
              </div>
              <label>
                공사
                <select
                  value={workLogForm.projectId}
                  onChange={(event) =>
                    setWorkLogForm({
                      ...workLogForm,
                      projectId: event.target.value,
                    })
                  }
                >
                  {yearlyProjectSummaries.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNo} · {order.projectName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="two-columns">
                <label>
                  작업일자
                  <input
                    type="date"
                    value={workLogForm.date}
                    onChange={(event) =>
                      setWorkLogForm({
                        ...workLogForm,
                        date: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  작업자 수
                  <input
                    min="1"
                    max="20"
                    type="number"
                    value={workLogForm.workerCount}
                    onChange={(event) => updateWorkerCount(event.target.value)}
                  />
                </label>
              </div>
              <div className="three-columns">
                <label>
                  작업시작
                  <input
                    type="time"
                    value={workLogForm.startTime}
                    onChange={(event) =>
                      setWorkLogForm({
                        ...workLogForm,
                        startTime: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  작업종료
                  <input
                    type="time"
                    value={workLogForm.endTime}
                    onChange={(event) =>
                      setWorkLogForm({
                        ...workLogForm,
                        endTime: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  잔업시간
                  <input
                    min="0"
                    step="0.5"
                    type="number"
                    value={workLogForm.overtimeHours}
                    onChange={(event) =>
                      setWorkLogForm({
                        ...workLogForm,
                        overtimeHours: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div className="calculation-note">
                1인 작업시간:{' '}
                {calculateWorkHours(
                  workLogForm.startTime,
                  workLogForm.endTime,
                  Number(workLogForm.overtimeHours) || 0,
                ).toFixed(1)}
                h / 점심 휴게 1시간 자동 차감
              </div>
              <div className="two-columns">
                <label>
                  작업장소
                  <input
                    value={workLogForm.location}
                    onChange={(event) =>
                      setWorkLogForm({
                        ...workLogForm,
                        location: event.target.value,
                      })
                    }
                    placeholder="예: 집진기실"
                  />
                </label>
                <label>
                  비고
                  <input
                    value={workLogForm.note}
                    onChange={(event) =>
                      setWorkLogForm({
                        ...workLogForm,
                        note: event.target.value,
                      })
                    }
                    placeholder="예: 안전교육 후 작업"
                  />
                </label>
              </div>
              <label>
                작업내용
                <input
                  value={workLogForm.task}
                  onChange={(event) =>
                    setWorkLogForm({
                      ...workLogForm,
                      task: event.target.value,
                    })
                  }
                  placeholder="예: 덕트 설치 및 용접"
                />
              </label>

              <div className="worker-entry-list">
                {workLogForm.workers.map((worker, index) => (
                  <div className="worker-entry compact" key={index}>
                    <strong>작업자 {index + 1}</strong>
                    <label>
                      작업자
                      <input
                        value={worker.worker}
                        onChange={(event) =>
                          updateWorkerInput(
                            index,
                            'worker',
                            event.target.value,
                          )
                        }
                        placeholder="예: 김현수"
                      />
                    </label>
                    <label>
                      직원/인력
                      <select
                        value={worker.workerType}
                        onChange={(event) =>
                          updateWorkerInput(
                            index,
                            'workerType',
                            event.target.value,
                          )
                        }
                      >
                        <option>직원</option>
                        <option>인력</option>
                      </select>
                    </label>
                  </div>
                ))}
              </div>
              <div className="modal-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setIsWorkLogModalOpen(false)}
                >
                  취소
                </button>
                <button className="primary-button" type="submit">
                  작업일보 추가
                </button>
              </div>
            </form>
          </div>
        )}

            <div className="panel wide">
              <div className="panel-heading">
                <h3>선택 공사 작업일보</h3>
                <span>{(selectedProject?.manDays ?? 0).toFixed(2)}명</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{renderWorkLogSortButton('date', '일자')}</th>
                      <th>{renderWorkLogSortButton('worker', '작업자')}</th>
                      <th>{renderWorkLogSortButton('workerType', '구분')}</th>
                      <th>{renderWorkLogSortButton('startTime', '시작')}</th>
                      <th>{renderWorkLogSortButton('endTime', '종료')}</th>
                      <th>{renderWorkLogSortButton('overtimeHours', '잔업')}</th>
                      <th>{renderWorkLogSortButton('location', '장소')}</th>
                      <th>{renderWorkLogSortButton('task', '작업내용')}</th>
                      <th>{renderWorkLogSortButton('note', '비고')}</th>
                      <th>{renderWorkLogSortButton('hours', '시간')}</th>
                      <th>{renderWorkLogSortButton('hours', '공수')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkLogs.map((workLog) => (
                      <tr key={workLog.id}>
                        <td>{workLog.date}</td>
                        <td>{workLog.worker}</td>
                        <td>{workLog.workerType}</td>
                        <td>{workLog.startTime}</td>
                        <td>{workLog.endTime}</td>
                        <td>{workLog.overtimeHours.toFixed(1)}h</td>
                        <td>{workLog.location || '-'}</td>
                        <td>{workLog.task}</td>
                        <td>{workLog.note || '-'}</td>
                        <td>{workLog.hours.toFixed(1)}h</td>
                        <td>{(workLog.hours / 8).toFixed(2)}명</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

export default App
