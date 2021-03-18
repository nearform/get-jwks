'use strict'

const t = require('tap')
const jwkToPem = require('jwk-to-pem')
const sinon = require('sinon')

const { jwks } = require('./constants')
const buildGetJwks = require('../src/get-jwks')

t.test('it provides the result of getJwk to jwkToPem', async t => {
  const getJwks = buildGetJwks()

  const [jwk] = jwks.keys

  const getJwkStub = sinon.stub(getJwks, 'getJwk').resolves(jwk)

  const signature = 'whatever'

  const pem = await getJwks.getPublicKey(signature)

  t.equal(pem, jwkToPem(jwk))
  sinon.assert.calledOnceWithExactly(getJwkStub, signature)
})

t.test('it rejects if getJwk rejects', t => {
  const getJwks = buildGetJwks()

  sinon.stub(getJwks, 'getJwk').rejects(new Error('boom'))

  return t.rejects(getJwks.getPublicKey('whatever'), 'boom')
})
