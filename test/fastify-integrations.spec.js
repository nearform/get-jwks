const t = require('tap')
const nock = require('nock')
const Fastify = require('fastify')
const fastifyJwt = require('fastify-jwt')

const buildGetJwks = require('../src/get-jwks')

t.beforeEach((done) => {
  nock.disableNetConnect()
  done()
})

t.afterEach((done) => {
  nock.cleanAll()
  nock.enableNetConnect()
  done()
})

const jwks = {
  keys: [
    {
      alg: 'RS512',
      kid: 'KEY_0',
      e: 'AQAB',
      kty: 'RSA',
      n: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImp0aSI6ImZmMTBmMTg1LWFiODEtNDhjYS1hZmI1LTdkY2FhMzNmYzgzNSIsImlhdCI6MTYxNDEwMzkxNiwiZXhwIjoxNjE0MTA3NTE2fQ.mLx1TZaHDhcymZFmLM7pfBhowY7CEgjuxr54LPXpGXc',
      use: 'sig'
    },
    {
      alg: 'HS256',
      kid: 'KEY_1',
      e: 'AQAB',
      kty: 'RSA',
      n: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.zbgd5BNF1cqQ_prCEqIvBTjSxMS8bDLnJAE_wE-0Cxg',
      use: 'sig'
    }
  ]
}

t.test('fastify-jwt', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const localKey = jwks.keys[1]
  const domain = 'https://localhost/'
  const alg = localKey.alg
  const kid = localKey.kid
  const getJwks = buildGetJwks()
  const publicKey = await getJwks.getPublicKey({ domain, alg, kid })

  t.test('Fastify should register without missing secret errors', function (t) {
    const fastify = Fastify()
    fastify.register(fastifyJwt, {
      secret: publicKey
    })
    fastify.ready((err) => {
      t.equal(err, undefined)
      t.done()
    })
  })
})
