'use strict'

const nock = require('nock')
const t = require('tap')

const { jwks, domain } = require('./constants')
const buildGetJwks = require('../src/get-jwks')

const PERF_THRESHOLD_MS = {
  normalReturn: 25,
}

t.beforeEach(() => {
  nock.disableNetConnect()
})

t.afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
})

const getPerfResults = async fn => {
  const perfResults = []
  for (let i = 0; i < 10; i++) {
    const perfStart = process.hrtime()
    await fn()
    const perfDiff = process.hrtime(perfStart)
    perfResults.push(perfDiff[0] * 1000 + perfDiff[1] / 10 ** 6)
  }
  return perfResults
}

t.test('under threshold if alg and kid match', async t => {
  nock(domain).persist().get('/.well-known/jwks.json').reply(200, jwks)

  const perfResults = await getPerfResults(async () => {
    const getJwks = buildGetJwks()
    const key = jwks.keys[0]
    const jwk = await getJwks.getJwk({ domain, alg: key.alg, kid: key.kid })
  })

  t.ok(perfResults.every(r => r < PERF_THRESHOLD_MS.normalReturn))
})

t.test('returns a jwk if no alg is provided and kid match', async t => {
  nock(domain).persist().get('/.well-known/jwks.json').reply(200, jwks)
  const perfResults = await getPerfResults(async () => {
    const getJwks = buildGetJwks()
    const key = jwks.keys[2]

    const jwk = await getJwks.getJwk({ domain, kid: key.kid })
  })

  t.ok(perfResults.every(r => r < PERF_THRESHOLD_MS.normalReturn))
})

t.test(
  'returns a jwk if no alg is provided and kid match but jwk has alg',
  async t => {
    nock(domain).get('/.well-known/jwks.json').reply(200, jwks)
    const perfResults = await getPerfResults(async () => {
      const getJwks = buildGetJwks()
      const key = jwks.keys[1]

      const jwk = await getJwks.getJwk({ domain, kid: key.kid })
    })

    t.ok(perfResults.every(r => r < PERF_THRESHOLD_MS.normalReturn))
  },
)