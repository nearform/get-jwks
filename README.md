# get-jwks

[![Build](https://github.com/nearform/get-jwks/workflows/CI/badge.svg)](https://github.com/nearform/get-jwks/actions?query=workflow%3ACI)

Fetch utils for JWKS keys

## Installation

```bash
npm install get-jwks
```

## Usage

### getJwk

```javascript
const buildGetJwks = require('get-jwks')

const getJwks = buildGetJwks()

const jwk = await getJwks.getJwk({
  domain: 'https://exampe.com/',
  alg: 'token_alg',
  kid: 'token_kid'
})

```
Calling the asynchronous function `getJwk` will fetch the [JSON Web Key](https://tools.ietf.org/html/rfc7517), and verify if any of the public keys matches the `alg` and `kid` values of your JWT token.  It will cache the matching key so if called again it will not make another request to retrieve a JWKS.
- `domain`: A string containing the domain (ie: `https://www.example.com/`) from which the library should fetch the JWKS. `get-jwks` will add the JWKS location (`.well-known/jwks.json`) to form the final url (ie: `https://www.example.com/.well-known/jwks.json`).
- `alg`: The alg header parameter represents the cryptographic algorithm used to secure the token. You will find it in your decoded JWT.
- `kid`: The kid is a hint that indicates which key was used to secure the JSON web signature of the token. You will find it in your decoded JWT.

### getPublicKey

```javascript
const buildGetJwks = require('get-jwks')

const getJwks = buildGetJwks()

const publicKey = await getJwks.getPublicKey({
  domain: 'https://exampe.com/',
  alg: 'token_alg',
  kid: 'token_kid'
})

```

Calling the asynchronous function `getPublicKey` will run the `getJwk` function to retrieve a matching key, then convert it to a PEM public key.  It requires the same arguments as `getJwk`.

### clearCache

```javascript
getJwks.clearCache()
```
Clears all contents of the cache

### Optional cache constuctor

When creating the cache constructor you pass some optional parameters based off the [tiny-lru](https://www.npmjs.com/package/tiny-lru) package.
- `max`: Max items to hold in cache, the default setting is 100.
- `ttl`: Milliseconds an item will remain in cache; lazy expiration upon next get() of an item, the default setting is 60000.

```javascript
const buildGetJwks = require('get-jwks')

const getJwks = buildGetJwks({
  max: 500,
  ttl: 60 * 1000
})
```

## Integration Examples

### fastify-jwt
[fastify-jwt](https://github.com/fastify/fastify-jwt) is a Json Web Token plugin for [Fastify](https://www.fastify.io/).

The following example includes a scenario where you'd like to varify a JWT against a valid JWK on any request to your Fastify server.  Any request with a valid JWT auth token in the header will return a successful response, otherwise will respond with an authentication error.

```javascript
const Fastify = require('fastify')
const fjwt = require('fastify-jwt')
const buildGetJwks = require('get-jwks')

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
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.send(err)
  }
})

fastify.listen(3000)
```


