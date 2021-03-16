'use strict'

const t = require('tap')
const nock = require('nock')
const Fastify = require('fastify')
const fjwt = require('fastify-jwt')

const { jwks, token, domain } = require('./constants')
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

t.test('fastify-jwt integration tests', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)

  const fastify = Fastify()
  const getJwks = buildGetJwks()

  fastify.register(fjwt, {
    decode: { complete: true },
    secret: (request, token, callback) => {
      const { header: { kid, alg }, payload: { iss } } = token
      getJwks.getPublicKey({ kid, domain: iss, alg })
        .then(publicKey => callback(null, publicKey), callback)
    }
  })

  fastify.addHook('onRequest', async (request, reply) => {
    await request.jwtVerify()
  })

  fastify.get('/', async (request, reply) => {
    return request.user.name
  })

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
