'use strict'

const t = require('tap')
const nock = require('nock')
const Fastify = require('fastify')
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

  fastify.register(require('fastify-jwt'), {
    decode: { complete: true },
    secret: async (request, token, callback) => {
      const { header: { kid, alg }, payload: { iss } } = token
      const publicKey = await getJwks.getPublicKey({ kid, domain: iss, alg })
      callback(null, publicKey)
    }
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
