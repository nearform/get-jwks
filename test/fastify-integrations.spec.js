const t = require('tap')
const nock = require('nock')
const Fastify = require('fastify')
const fastifyJwt = require('fastify-jwt')

const jwks = require('../constants').jwks
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

t.test('integration tests', async t => {
  nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks)
  const localKey = jwks.keys[1]
  const domain = 'https://localhost/'
  const alg = localKey.alg
  const kid = localKey.kid
  const getJwks = buildGetJwks()


  t.test('Fastify should start with fastify-jwt and get-jwks', t => {
    const fastify = Fastify()
    fastify.register(require('fastify-jwt'), {
      ignoreExpiration: true,
      decode: { complete: true },
      secret: async (request, token, callback) => {
        const { header: { kid, alg }, payload: { iss: domain } } = token
        const publicKey = await getJwks.getPublicKey({ kid, domain, alg })
        callback(null, publicKey)
      }
    })
    fastify.addHook("onRequest", async (request, reply) => {
      try {
        await request.jwtVerify()
      } catch (err) {
        reply.send(err)
      }
    })
    fastify.get('/', async () => {
      return 'hello world'
    })

    t.tearDown(fastify.close.bind(fastify))

    fastify.listen(3000)
      .then(() => {
        t.test('requests the "/" route', async t => {
          const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IktFWV8xIiwibiI6IjEyMyJ9.eyJuaWNrbmFtZSI6IkpvZSBCbG9nZ3MiLCJuYW1lIjoiam9lQGJsb2dncy5jb20iLCJpc3MiOiJodHRwczovL2xvY2FsaG9zdC8iLCJzdWIiOiJhdXRoMHwxMjM0NSIsImF1ZCI6IjEyMzQ1IiwiaWF0IjoxNjE0MDc1OTg0LCJleHAiOjE2MTQxMTE5ODQsImF0X2hhc2giOiJXTWRKZFJ1TUhTdkZhb0pIYXdXTVl3Iiwibm9uY2UiOiIyU1EucVhQTDNaQW85c3F1VW1FQWhnQV92UkdWdDVxSCJ9.WkYnHstBpvgBNnmDM7JXoQgwFYKq8_Cio1I7o3tLflo'
          const response = await fastify.inject({
            method: 'GET',
            url: '/',
            headers: {
              'Authorization': `Bearer ${ token }`
            }
          })
          t.strictEqual(response.statusCode, 200)
          t.strictEqual(response.body, 'hello world')
          t.done()
        })
      })


  })
})
