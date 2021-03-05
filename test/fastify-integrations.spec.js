'use strict'

const { readFileSync } = require('fs')
const t = require('tap')
const nock = require('nock')
const Fastify = require('fastify')

const jwks = require('./constants').jwks
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

t.test('integration tests', t => {
  const domain = 'https://localhost/'

  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)

  const jwk = jwks.keys[1]
  const getJwks = buildGetJwks()
  const customErrorMessages = {
    badRequestErrorMessage: (err) => {console.log('Test Error: ', err.message); return err.message},
    noAuthorizationInHeaderMessage: (err) => {console.log('Test Error: ', err.message); return err.message},
    authorizationTokenExpiredMessage: (err) => {console.log('Test Error: ', err.message); return err.message},
    authorizationTokenInvalid: (err) => {console.log('Test Error: ', err.message); return err.message}
  }

  const fastify = Fastify()
  fastify.register(require('fastify-jwt'), {
    ignoreExpiration: true,
    decode: { complete: true },
    secret: {
      private: {
        passphrase: 'mysecret',
        key: readFileSync(`${__dirname}/private.pem`, 'utf8')
      },
      public: async (request, token, callback) => {
        const { header: { kid, alg }, payload: { iss } } = token
        const key = await getJwks.getJwk({ kid, domain: iss, alg })
        const publicKey = await getJwks.getPublicKey({ kid, domain: iss, alg })
        callback(null, publicKey)
      }
    },
    sign: {
      keyid: jwk.kid,
      algorithm: jwk.alg,
      issuer: domain
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
      const token = fastify.jwt.sign({ name: 'John Doe' })
      const response = await fastify.inject({
        method: 'GET',
        url: '/',
        headers: {
          authorization: `Bearer ${token}`
        }
      })
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.body, 'John Doe')
      t.done()
    })
})
