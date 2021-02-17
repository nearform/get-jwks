# jwks-fetch

[![Build](https://github.com/nearform/jwks-fetch/workflows/CI/badge.svg)](https://github.com/nearform/jwks-fetch/actions?query=workflow%3ACI)

Fetch utils for JWKS keys

## Installation

Just run:

```bash
npm install jwks-fetch
```

## Usage

```javascript
const buildJwksFetch = require('jwks-fetch')

const jwksFetch = buildJwksFetch()

const secret = await jwksFetch.getSecret({
  domain: 'https://exampe.com/',
  alg: 'token_alg',
  kid: 'token_kid'
})

// to clear the secret in cache
jwksFetch.clearCache()

```


### getSecret

Calling the `jwksFetch.getSecret` will fetch the [JSON Web Key](https://tools.ietf.org/html/rfc7517), Set and verify if any of the public keys matches the `alg` and `kid` values of your JWT token.  And it will cache the secret so if called again it will not make another http request to return the secret.  It is asynchronous.

- `domain`: A string containing the domain (ie: `https://www.example.com/`) from which the library should fetch the JWKS. `jwks-fetch` will add the JWKS location (`.well-known/jwks.json`) to form the final url (ie: `https://www.example.com/.well-known/jwks.json`).
- `alg`: The alg header parameter represents the cryptographic algorithm used to secure the token. You will find it in your decoded JWT.
- `kid`: The kid is a hint that indicates which key was used to secure the JSON web signature of the token. You will find it in your decoded JWT.

### clearCache

Clears the contents of the cache

### Optional cache constuctor

When creating the cache contructor you pass some optional parameters based off the [tiny-lru](https://www.npmjs.com/package/tiny-lru) package.
- `max`: Max items to hold in cache, the default setting is 100.
- `ttl`: Milliseconds an item will remain in cache; lazy expiration upon next get() of an item, the default setting is 60000.

```javascript
const buildJwksFetch = require('jwks-fetch')

const jwksFetch = buildJwksFetch({
  max: 500,
  ttl: 60 * 1000
})
```


