# get-jwks

[![Build](https://github.com/nearform/get-jwks/workflows/CI/badge.svg)](https://github.com/nearform/get-jwks/actions?query=workflow%3ACI)

Fetch utils for JWKS keys

## Installation

```bash
npm install get-jwks
```

## Usage

### Options

```js
const https = require('https')
const buildGetJwks = require('get-jwks')

const getJwks = buildGetJwks({
  max: 100,
  ttl: 60 * 1000,
  allowedDomains: ['https://example.com'],
  providerDiscovery: false,
  agent: new https.Agent({
    keepAlive: true,
  }),
})
```

- `max`: Max items to hold in cache. Defaults to 100.
- `ttl`: Milliseconds an item will remain in cache. Defaults to 60s.
- `allowedDomains`: Array of allowed domains. By default all domains are allowed.
- `providerDiscovery`: Indicates if the Provider Configuration Information is used to automatically get the jwks_uri from the [OpenID Provider Discovery Endpoint](https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfig). This endpoint is exposing the [Provider Metadata](https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata). With this flag set to true the domain will be treated as the OpenID Issuer which is the iss property in the token. Defaults to false. Ignored if jwksPath is specified.
- `jwksPath`: Specify a relative path to the jwks_uri. Example `/otherdir/jwks.json`. Takes precedence over providerDiscovery. Optional.
- `agent`: The custom agent to use for requests, as specified in [node-fetch documentation](https://github.com/node-fetch/node-fetch#custom-agent). Defaults to `null`.

> `max` and `ttl` are provided to [lru-cache](https://www.npmjs.com/package/lru-cache).

### getJwk

```js
const buildGetJwks = require('get-jwks')

const getJwks = buildGetJwks()

const jwk = await getJwks.getJwk({
  domain: 'https://example.com/',
  alg: 'token_alg',
  kid: 'token_kid',
})
```

Calling the asynchronous function `getJwk` will fetch the [JSON Web Key](https://tools.ietf.org/html/rfc7517), and verify if any of the public keys matches the provided `alg` (if any) and `kid` values. It will cache the matching key so if called again it will not make another request to retrieve a JWKS. It will also use a cache to store stale values which is used in case of errors as a fallback mechanism.

- `domain`: A string containing the domain (e.g. `https://www.example.com/`, with or without trailing slash) from which the library should fetch the JWKS. If providerDiscovery flag is set to false `get-jwks` will add the JWKS location (`.well-known/jwks.json`) to form the final url (ie: `https://www.example.com/.well-known/jwks.json`) otherwise the domain will be treated as tthe openid issuer and the retrival will be done via the Provider Discovery Endpoint.
- `alg`: The alg header parameter is an optional parameter that represents the cryptographic algorithm used to secure the token. You will find it in your decoded JWT.
- `kid`: The kid is a hint that indicates which key was used to secure the JSON web signature of the token. You will find it in your decoded JWT.

### getPublicKey

```js
const buildGetJwks = require('get-jwks')

const getJwks = buildGetJwks()

const publicKey = await getJwks.getPublicKey({
  domain: 'https://exampe.com/',
  alg: 'token_alg',
  kid: 'token_kid',
})
```

Calling the asynchronous function `getPublicKey` will run the `getJwk` function to retrieve a matching key, then convert it to a PEM public key. It requires the same arguments as `getJwk`.

## Integration Examples

This library can be easily used with other JWT libraries.

### @fastify/jwt

[@fastify/jwt](https://github.com/fastify/fastify-jwt) is a Json Web Token plugin for [Fastify](https://www.fastify.io/).

The following example includes a scenario where you'd like to varify a JWT against a valid JWK on any request to your Fastify server. Any request with a valid JWT auth token in the header will return a successful response, otherwise will respond with an authentication error.

```js
const Fastify = require('fastify')
const fjwt = require('@fastify/jwt')
const buildGetJwks = require('get-jwks')

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

fastify.addHook('onRequest', async (request, reply) => {
  await request.jwtVerify()
})

fastify.listen(3000)
```

### fast-jwt

[fast-jwt](https://github.com/nearform/fast-jwt) is a fast JSON Web Token implementation.

The following example shows how to use JWKS in fast-jwt via get-jwks.

```js
const { createVerifier } = require('fast-jwt')
const buildGetJwks = require('get-jwks')

// well known url of the token issuer
// often encoded as the `iss` property of the token payload
const domain = 'https://...'

const getJwks = buildGetJwks({ allowedDomains: [...]})

// create a verifier function with key as a function
const verifyWithPromise = createVerifier({
  key: async function ({ header }) {
    const publicKey = await getJwks.getPublicKey({
      kid: header.kid,
      alg: header.alg,
      domain,
    })
    return publicKey
  },
})

const payload = await verifyWithPromise(token)
```
