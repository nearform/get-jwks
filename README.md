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
const jwksFetch = require('jwks-fetch')


cosnt secret = await jwksFetch({
  domain: 'https://exampe.com/',
  alg: 'token_alg',
  kid: 'token_kid'
})

// if you want to use a cache to not fetch the JWKS every time

const NodeCache = require('node-cache')
const cache = new NodeCache()
cosnt secret = await jwksFetch({
  domain: 'https://exampe.com/',
  alg: 'token_alg',
  kid: 'token_kid',
  cache
})
```


### jwksFetch

Calling `jwksFetch` will fetch the [JSON Web Key](https://tools.ietf.org/html/rfc7517) Set and verify if any of the publi keys matches the `alg` and `kid` values of your JWT token.

- `domain`: A string containing the domain (ie: `https://www.example.com/`) from which the library should fetch the JWKS. `jwks-fetch` will add the JWKS location (`.well-known/jwks.json`) to form the final url (ie: `https://www.example.com/.well-known/jwks.json`).
- `alg`: The alg header parameter represents the cryptographic algorithm used to secure the token. You will find it in your decoded JWT.
- `kid`: The kid is a hint that indicates which key was used to secure the JSON web signature of the token. You will find it in your decoded JWT.
- `cache`: This is an optional parameter. You can provide a cache (ie: [NodeCache](https://github.com/node-cache/node-cache)) implementation for jwksFetch.

#### How `jwks-fetch` uses the `cache` parameter

If the `cache` parameter is provided, `jwks-fetch` will first look for a matching public key in the cache.

If a match is found, it will be returned.

If no match is found, `jwks-fetch` will try to fetch the JWKS from the given `domain`.

Once the JWKS is fetched, `jwks-fetch` will look for a matching public key, and if found it will save it in the cache and return it.

If a matching key is not found, even after fetching from the JWKS, `jwks-fetch` flags that particular combination of `domain`/`alg`/`kid` as "missing" (saving `null` in the cache). Until the specific cache key is not deleted, `jwks-fetch` will not try to fetch again the JWKS for that particular combination.
