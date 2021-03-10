'use strict'

const { readFileSync } = require('fs')
const path = require('path')
const t = require('tap')
const nock = require('nock')
const Fastify = require('fastify')

const jwks = require('./constants').jwks
const buildGetJwks = require('../src/get-jwks')
const jwt = require('jsonwebtoken')

t.beforeEach((done) => {
  nock.disableNetConnect()
  done()
})

t.afterEach((done) => {
  nock.cleanAll()
  nock.enableNetConnect()
  done()
})

t.test('integration tests', t => {
  const domain = 'https://localhost/'

  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)

  const privateKey = readFileSync(path.join(__dirname, 'private.pem'), 'utf8')
  const jwk = jwks.keys[1] // https://russelldavies.github.io/jwk-creator/
  const token = jwt.sign({ name: 'Jane Doe' }, privateKey, { algorithm: jwk.alg, issuer: domain, keyid: jwk.kid })

  const customErrorMessages = {
    badRequestErrorMessage: (err) => { console.log('Test Error: ', err.message); return err.message },
    noAuthorizationInHeaderMessage: (err) => { console.log('Test Error: ', err.message); return err.message },
    authorizationTokenExpiredMessage: (err) => { console.log('Test Error: ', err.message); return err.message },
    authorizationTokenInvalid: (err) => { console.log('Test Error: ', err.message); return err.message }
  }

  const fastify = Fastify()
  const getJwks = buildGetJwks()

  fastify.register(require('fastify-jwt'), {
    ignoreExpiration: true,
    decode: { complete: true },
    secret: async (request, token, callback) => {
      const { header: { kid, alg }, payload: { iss } } = token
      const publicKey = await getJwks.getPublicKey({ kid, domain: iss, alg })
      callback(null, publicKey)
    },
    messages: customErrorMessages
  })

  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  })
  fastify.get('/', async (request, reply) => {
    return request.user.name
  })

  t.tearDown(fastify.close.bind(fastify))

  fastify.listen(3000)
    .then(async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/',
        headers: {
          authorization: `Bearer ${token}`
        }
      })
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.body, 'Jane Doe')
      t.done()
    })
})
