import { expectAssignable } from 'tsd'
import Cache from '../../src/cache'
import buildGetJwks, { GetJwksOptions, GetPublicKeyOptions, JWK, JWKSignature } from '../../src/get-jwks'
import * as undici from "undici-types";

const { getPublicKey, getJwk, getJwksUri, cache, staleCache } = buildGetJwks()

expectAssignable<(signature: JWKSignature) => Promise<JWK>>(getJwk)
expectAssignable<(normalizedDomain: string) => Promise<string>>(getJwksUri)
expectAssignable<(options?: GetPublicKeyOptions) => Promise<string>>(getPublicKey)
expectAssignable<Cache<string, JWK>>(cache)
expectAssignable<Cache<string, JWK>>(staleCache)
expectAssignable<GetJwksOptions['fetchOptions']>({
    dispatcher: undici.getGlobalDispatcher()
})
