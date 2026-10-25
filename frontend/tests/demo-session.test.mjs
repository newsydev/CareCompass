import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url))
const password = 'OnlyForTests123!'

function createHarness() {
  const data = new Map()
  const accounts = new Map()
  const cache = new Map()
  const slots = []
  const effects = []
  let cursor = 0
  let uuid = 0
  let currentEmail = null
  let failRequests = false
  let writeBarrier = null
  const copy = value => JSON.parse(JSON.stringify(value))
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  }
  function account() {
    if (failRequests) throw new Error('Database unavailable')
    if (!currentEmail) throw { isAxiosError: true, response: { status: 401 } }
    return accounts.get(currentEmail)
  }
  const api = {
    accountError: failure => failure.message ?? 'Please log in.',
    async loadAccount() {
      const saved = account()
      return copy({ profile: saved.profile, chats: saved.chats })
    },
    async authenticate(email, value, name) {
      if (failRequests) throw new Error('Database unavailable')
      email = email.trim().toLowerCase()
      if (name !== undefined) {
        if (accounts.has(email)) throw new Error('Account exists')
        accounts.set(email, { password: value, profile: {
          email, name, address: '', medicalHistory: '', pregnant: false, immunocompromised: false,
        }, chats: [] })
      }
      const saved = accounts.get(email)
      if (!saved || saved.password !== value) throw new Error('Email or password is incorrect.')
      currentEmail = email
      return copy({ profile: saved.profile, chats: saved.chats })
    },
    async endSession() {
      if (failRequests) throw new Error('Database unavailable')
      currentEmail = null
    },
    async putProfile(profile) {
      const saved = account()
      saved.profile = copy(profile)
      return copy(profile)
    },
    async putChat(chat) {
      if (writeBarrier) await writeBarrier
      const saved = account()
      const previous = saved.chats.find(item => item.id === chat.id)
      assert.equal(chat.revision, previous?.revision ?? 0)
      const result = {
        ...copy(chat), revision: chat.revision + 1, updatedAt: new Date().toISOString(),
        title: chat.messages.find(turn => turn.role === 'user')?.content.slice(0, 60) ?? 'Care conversation',
      }
      saved.chats = [result, ...saved.chats.filter(item => item.id !== chat.id)]
      return copy(result)
    },
    async importDemo(profile, chats) {
      const saved = account()
      saved.profile = copy(profile)
      for (const chat of chats) {
        if (!saved.chats.some(item => item.id === chat.id)) saved.chats.push(copy(chat))
      }
      return copy({ profile: saved.profile, chats: saved.chats })
    },
  }
  const react = {
    createContext: value => ({ value, Provider: 'AccountProvider' }),
    useContext: context => context.value,
    useState(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, action => {
        slots[index].value = typeof action === 'function' ? action(slots[index].value) : action
      }]
    },
    useRef(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect(effect) {
      const index = cursor++
      if (!slots[index]) {
        slots[index] = {}
        effects.push(effect)
      }
    },
  }
  function load(filename) {
    const full = path.resolve(sourceRoot, filename)
    const file = existsSync(full) ? full : existsSync(`${full}.ts`) ? `${full}.ts` : `${full}.tsx`
    if (cache.has(file)) return cache.get(file)
    const module = { exports: {} }
    cache.set(file, module.exports)
    const source = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    runInNewContext(source, {
      module, exports: module.exports, sessionStorage: storage, AbortController,
      crypto: { randomUUID: () => `test-chat-${++uuid}` },
      require(specifier) {
        if (specifier === 'react') return react
        if (specifier === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) }
        if (specifier === 'axios') return {
          isCancel: () => false, isAxiosError: failure => failure?.isAxiosError === true,
        }
        if (specifier.endsWith('/api/accounts')) return api
        if (specifier.startsWith('.')) return load(path.resolve(path.dirname(file), specifier))
        throw new Error(`Unexpected test dependency: ${specifier}`)
      },
    }, { filename: file })
    return module.exports
  }
  const { DemoSessionProvider } = load('components/DemoSessionProvider.tsx')
  const harness = {
    data, storage, load,
    failRequests: value => { failRequests = value },
    pauseWrites() {
      let release
      writeBarrier = new Promise(resolve => { release = resolve })
      return () => { writeBarrier = null; release() }
    },
    render() {
      cursor = 0
      const value = DemoSessionProvider({ children: null }).props.value
      for (const effect of effects.splice(0)) effect()
      return value
    },
    async ready() {
      harness.render()
      await new Promise(resolve => setImmediate(resolve))
      return harness.render()
    },
    async remount() {
      slots.length = 0
      return harness.ready()
    },
  }
  return harness
}

function record(h, id, text = 'I need a lab test') {
  const { patientContextFromProfile } = h.load('utils/patientContext.ts')
  return {
    id, messages: [{ role: 'user', content: text }, { role: 'assistant', content: 'Demo guidance, not a diagnosis.' }],
    patientContext: patientContextFromProfile(), recipient: 'self', emergency: false,
  }
}

test('password accounts retain history after logout and each login starts a fresh chat', async () => {
  const h = createHarness()
  assert.equal((await h.ready()).profile, null)
  assert.equal(await h.render().login(' John@gmail.com ', password, 'John'), true)
  const first = h.render().activeChatId
  assert.equal(h.render().profile.email, 'john@gmail.com')
  assert.equal(await h.render().saveChat(record(h, first)), true)
  await h.render().logout()
  assert.equal(h.render().profile, null)
  assert.equal(h.render().chats.length, 0)
  assert.equal(await h.render().login('john@gmail.com', 'wrong'), false)
  assert.equal(h.render().profile, null)
  assert.equal(await h.render().login('john@gmail.com', password), true)
  assert.notEqual(h.render().activeChatId, first)
  assert.equal(h.render().chats[0].id, first)
  h.render().selectChat(first)
  assert.equal(h.render().activeChatId, first)
  assert.equal([...h.data.keys()].some(key => key.includes('password')), false)
})

test('profiles and chats are isolated between accounts and hydrate after refresh', async () => {
  const h = createHarness()
  await h.ready()
  await h.render().login('john@gmail.com', password, 'John Doe')
  await h.render().updateProfile({ ...h.render().profile, address: 'Fictional demo street', ageYears: 35, medicalHistory: 'Demo history', immunocompromised: true })
  await h.render().saveChat(record(h, h.render().activeChatId))
  await h.render().logout()
  await h.render().login('jane@example.com', password, 'Jane')
  assert.equal(h.render().chats.length, 0)
  assert.equal(h.render().profile.address, '')
  await h.render().logout()
  await h.render().login('john@gmail.com', password)
  const fresh = await h.remount()
  assert.equal(fresh.loading, false)
  assert.equal(fresh.profile.name, 'John Doe')
  assert.equal(fresh.profile.address, 'Fictional demo street')
  assert.equal(fresh.profile.ageYears, 35)
  assert.equal(fresh.profile.immunocompromised, true)
  assert.equal(fresh.chats.length, 1)
})

test('queued writes use the latest revision and navigation waits for saving', async () => {
  const h = createHarness()
  await h.ready()
  await h.render().login('john@gmail.com', password, 'John')
  const id = h.render().activeChatId
  const release = h.pauseWrites()
  const first = h.render().saveChat(record(h, id, 'First turn'))
  const second = h.render().saveChat({ ...record(h, id, 'Updated turn'), emergency: true })
  assert.equal(h.render().saving, true)
  h.render().newChat()
  assert.equal(h.render().activeChatId, id)
  await h.render().logout()
  assert.notEqual(h.render().profile, null)
  release()
  assert.equal(await first, true)
  assert.equal(await second, true)
  assert.equal(h.render().saving, false)
  assert.equal(h.render().chats[0].revision, 2)
  assert.equal(h.render().chats[0].messages[0].content, 'Updated turn')
  assert.equal(h.render().chats[0].emergency, true)
  h.render().newChat()
  assert.notEqual(h.render().activeChatId, id)
})

test('database failures are visible and never claim successful writes or logout', async () => {
  const h = createHarness()
  await h.ready()
  h.failRequests(true)
  assert.equal(await h.render().login('john@gmail.com', password, 'John'), false)
  assert.match(h.render().error, /Database unavailable/)
  h.failRequests(false)
  await h.render().login('john@gmail.com', password, 'John')
  const before = h.render().profile
  h.failRequests(true)
  assert.equal(await h.render().updateProfile({ ...before, name: 'Not saved' }), false)
  assert.equal(h.render().profile.name, before.name)
  assert.equal(await h.render().saveChat(record(h, h.render().activeChatId)), false)
  assert.equal(h.render().chats.length, 0)
  assert.match(h.render().error, /Conversation not saved/)
  await h.render().logout()
  assert.notEqual(h.render().profile, null)
  assert.match(h.render().error, /Could not log out/)
  h.failRequests(false)
  assert.equal(await h.render().saveChat(record(h, h.render().activeChatId)), true)
})

test('legacy data is imported only on explicit request and remains intact', async () => {
  const h = createHarness()
  const { saveDemoIdentity, saveDemoProfile } = h.load('utils/demoProfile.ts')
  const { saveDemoChat } = h.load('utils/chatHistory.ts')
  saveDemoIdentity('john@gmail.com', 'Legacy John')
  saveDemoProfile({ email: 'john@gmail.com', name: 'Legacy John', address: 'Demo address', medicalHistory: 'Legacy example', pregnant: false, immunocompromised: false })
  saveDemoChat('john@gmail.com', record(h, 'legacy-chat'))
  await h.ready()
  assert.equal(h.render().profile, null)
  await h.render().login('john@gmail.com', password, 'New account')
  assert.equal(h.render().profile.name, 'New account')
  assert.equal(h.render().chats.length, 0)
  assert.equal(await h.render().importLegacy(), true)
  assert.equal(h.render().profile.name, 'Legacy John')
  assert.equal(h.render().chats.length, 1)
  assert.equal(h.render().chats[0].id, 'legacy-chat')
  assert.notEqual(h.storage.getItem('carecompass.demo.chats:john@gmail.com'), null)
})

test('patient snapshots do not apply account history to another patient', () => {
  const h = createHarness()
  const { patientContextFromProfile, validatePatientContext } = h.load('utils/patientContext.ts')
  const { saveDemoChat, getDemoChats } = h.load('utils/chatHistory.ts')
  const context = patientContextFromProfile({ ageYears: 70, medicalHistory: 'diabetes', pregnant: true })
  assert.equal(context.age_years, 70)
  assert.equal(context.medical_history, 'diabetes')
  const other = patientContextFromProfile()
  assert.equal(other.age_years, undefined)
  assert.equal(other.medical_history, '')
  assert.equal(other.pregnant, false)
  assert.equal(Object.keys(other.vitals).length, 0)
  saveDemoChat('john@gmail.com', { ...record(h, 'other-patient'), patientContext: { ...other, age_years: 8 }, recipient: 'other', emergency: true })
  const saved = getDemoChats('john@gmail.com')[0]
  assert.equal(saved.recipient, 'other')
  assert.equal(saved.emergency, true)
  assert.equal(saved.patientContext.age_years, 8)
  assert.ok(validatePatientContext({ ...other, vitals: { oxygen_percent: 101 } }).includes('Oxygen'))
  assert.ok(validatePatientContext({ ...other, vitals: { systolic_bp: 80, diastolic_bp: 90 } }).includes('Systolic'))
})

test('corrupt legacy history is reported and never overwritten', () => {
  const h = createHarness()
  const { saveDemoChat, getDemoChats } = h.load('utils/chatHistory.ts')
  const key = 'carecompass.demo.chats:john@gmail.com'
  h.storage.setItem(key, '[{"id": "invalid"}]')
  assert.throws(() => getDemoChats('john@gmail.com'), /invalid format/)
  assert.throws(() => saveDemoChat('john@gmail.com', record(h, 'fresh')), /invalid format/)
  assert.equal(h.storage.getItem(key), '[{"id": "invalid"}]')
  h.storage.setItem(key, 'not json')
  assert.throws(() => getDemoChats('john@gmail.com'))
})

test('saved response text retains urgent actions, uncertainties and demo limitations', () => {
  const h = createHarness()
  const { describeResponse } = h.load('utils/chatSummary.ts')
  const summary = describeResponse({
    follow_up_question: null, care_type: 'emergency_112', urgency: 'emergency', red_flags: [], reasoning: 'Possible emergency',
    matched_caregivers: [],
    assessment: {
      level: 'emergency', possible_categories: ['Cause unknown'], risk_factors: [], next_steps: ['Do not delay.'],
      supportive_steps: [], missing_information: ['Age unknown.'],
      viral_status: 'Cannot establish viral illness.', disclaimer: 'Demo, not a diagnosis.',
    },
  })
  assert.match(summary, /112/)
  assert.match(summary, /No service has been contacted/)
  assert.match(summary, /not diagnoses/)
  assert.match(summary, /Age unknown/)
  assert.match(summary, /not a diagnosis/)
})

test('describeResponse generates Hindi response in Hindi mode for chat and TTS', () => {
  const h = createHarness()
  const { describeResponse } = h.load('utils/chatSummary.ts')
  const hiSummary = describeResponse({
    follow_up_question: null,
    care_type: 'paramedic_home_visit',
    urgency: 'same_day',
    red_flags: [],
    reasoning: 'General complaint suitable for a Medic home visit with optional virtual doctor consult; urgency assessed as same_day.',
    matched_caregivers: [],
    assessment: {
      level: 'routine',
      possible_categories: ['Viral illness'],
      risk_factors: [],
      next_steps: ['Rest and hydrate.'],
      supportive_steps: [],
      missing_information: [],
      viral_status: 'Cannot establish viral illness.',
      disclaimer: 'Demo, not a diagnosis.',
    },
  }, 'hi')

  assert.match(hiSummary, /सुझाई गई सेवा/)
  assert.match(hiSummary, /घर पर मेडिक विज़िट/)
  assert.match(hiSummary, /आज ही/)
  assert.match(hiSummary, /[\u0900-\u097f]/)
})
