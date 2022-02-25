import LRU from 'lru-cache'

type JWKSignature = { domain: string; alg: string; kid: string }
type JWK = { [key: string]: any; domain: string; alg: string; kid: string }

type GetPublicKeyOptions = {
  domain?: string
  alg?: string
  kid?: string
}

type GetJwksOptions = {
  max?: number
  ttl?: number
  allowedDomains?: string[]
  providerDiscovery?: boolean
  jwksPath?: string
  agent?: string
}

type GetJwks = {
  getPublicKey: (options?: GetPublicKeyOptions) => Promise<string>
  getJwk: (signature: JWKSignature) => Promise<JWK>
  getJwksUri: (normalizedDomain: string) => Promise<string>
  cache: LRU<string, JWK>
  staleCache: LRU<string, JWK>
}

export default function buildGetJwks(options?: GetJwksOptions): GetJwks
