'use strict'

const t = require('tap')
const nock = require('nock')
const Fastify = require('fastify')
const fjwt = require('@fastify/jwt')

const { oidcConfig, jwks, token, domain } = require('./constants')
const buildGetJwks = require('../src/get-jwks')

t.beforeEach(async () => {
  nock.disableNetConnect()
})

t.afterEach(async () => {
  nock.cleanAll()
  nock.enableNetConnect()
})

t.test('@fastify/jwt integration tests', async t => {
  nock(domain).get('/.well-known/jwks.json').reply(200, jwks)

  const fastify = Fastify()
  const getJwks = buildGetJwks()

  fastify.register(fjwt, {
    decode: { complete: true },
    secret: (request, token, callback) => {
      const {
        header: { kid, alg },
        payload: { iss },
      } = token
      getJwks
        .getPublicKey({ kid, domain: iss, alg })
        .then(publicKey => callback(null, publicKey), callback)
    },
  })

  fastify.addHook('onRequest', async request => {
    await request.jwtVerify()
  })

  fastify.get('/', async request => {
    return request.user.name
  })

  const response = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      authorization: `Bearer ${token}`,
    },
  })

  t.equal(response.statusCode, 200)
  t.equal(response.body, 'Jane Doe')
})

t.test('@fastify/jwt integration tests with providerDiscovery', async t => {
  nock(domain)
    .get('/.well-known/openid-configuration')
    .once()
    .reply(200, oidcConfig)
  nock(domain).get('/.well-known/certs').reply(200, jwks)

  const fastify = Fastify()
  const getJwks = buildGetJwks({ providerDiscovery: true })

  fastify.register(fjwt, {
    decode: { complete: true },
    secret: (request, token, callback) => {
      const {
        header: { kid, alg },
        payload: { iss },
      } = token
      getJwks
        .getPublicKey({ kid, domain: iss, alg })
        .then(publicKey => callback(null, publicKey), callback)
    },
  })
  fastify.addHook('onRequest', async request => {
    await request.jwtVerify()
  })

  fastify.get('/', async request => {
    return request.user.name
  })

  const response = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      authorization: `Bearer ${token}`,
    },
  })

  t.equal(response.statusCode, 200)
  t.equal(response.body, 'Jane Doe')
})
