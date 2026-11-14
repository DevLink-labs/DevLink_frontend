import { t } from "./i18n";
import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'

interface CsrfToken {
  headerName: string
  token: string
}

interface ApiEnvelope {
  success: boolean
  data: unknown
  code?: unknown
  message?: unknown
}

const configuredBaseUrl: unknown = import.meta.env.VITE_API_BASE_URL
export const API_BASE_URL = typeof configuredBaseUrl === 'string'
  ? configuredBaseUrl.trim().replace(/\/+$/, '')
  : ''

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code = 'REQUEST_FAILED') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const httpClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 20_000,
  withCredentials: true,
  withXSRFToken: false,
  adapter: 'fetch',
  fetchOptions: { cache: 'no-store' },
  headers: { Accept: 'application/json' },
  responseType: 'text',
  validateStatus: () => true,
  transformResponse: [(data: unknown) => data],
})

function isEnvelope(value: unknown): value is ApiEnvelope {
  return typeof value === 'object' && value !== null
    && 'success' in value && typeof value.success === 'boolean' && 'data' in value
}

function statusMessage(status: number): string {
  if (status === 401) return t("로그인이 필요하거나 세션이 만료되었습니다. 다시 로그인해주세요.")
  if (status === 403) return t("요청 권한이 없습니다. 로그인 상태와 팀 권한을 확인해주세요.")
  if (status === 404) return t("요청한 정보를 찾을 수 없습니다. 목록을 새로고침해주세요.")
  if (status === 409) return t("이미 처리되었거나 중복된 요청입니다. 현재 상태를 확인해주세요.")
  if (status >= 500) return t("서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 확인해주세요.")
  return t("요청을 처리하지 못했습니다. 입력한 내용을 확인해주세요.")
}

async function request<T>(path: string, options: AxiosRequestConfig<unknown> = {}): Promise<T> {
  const mutation = options.method !== undefined && options.method !== 'GET'

  try {
    const response = await httpClient.request<unknown>({ ...options, url: path })
    if (!String(response.headers['content-type'] ?? '').includes('application/json')) {
      throw new ApiError(
        t("API 응답을 읽을 수 없습니다. 프론트의 API 주소와 백엔드 실행 상태를 확인해주세요."),
        response.status,
        'INVALID_API_RESPONSE',
      )
    }

    let data: unknown
    try {
      data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
    } catch {
      throw new ApiError(t("서버 응답 형식이 올바르지 않습니다."), response.status, 'INVALID_API_RESPONSE')
    }
    if (!isEnvelope(data)) {
      throw new ApiError(t("서버 응답 형식이 올바르지 않습니다."), response.status, 'INVALID_API_RESPONSE')
    }
    if (response.status < 200 || response.status >= 300 || !data.success) {
      const message = typeof data.message === 'string' && data.message.trim()
        ? data.message
        : statusMessage(response.status)
      throw new ApiError(message, response.status, typeof data.code === 'string' ? data.code : 'REQUEST_FAILED')
    }
    return data.data as T
  } catch (error) {
    if (error instanceof ApiError || axios.isCancel(error)) throw error
    const timedOut = axios.isAxiosError(error)
      && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
    const timeoutMessage = timedOut
      ? t("서버 응답 시간이 초과되었습니다.")
      : t("서버에 연결하지 못했습니다.")
    throw new ApiError(
      mutation
        ? t("{{message}} 요청 결과가 저장되었을 수 있으니 새로고침으로 확인한 뒤 다시 시도해주세요.", { message: timeoutMessage })
        : t("{{message}} 백엔드 주소와 실행 상태를 확인해주세요.", { message: timeoutMessage }),
      0,
      timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
    )
  }
}

// 세션 교체와 상태 변경 요청의 순서를 유지하며 자동 재전송 방지
let mutationQueue: Promise<void> = Promise.resolve()

function mutate<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const send = async () => {
    // 로그인·로그아웃 후 바뀐 세션에 맞춰 매 요청마다 CSRF 토큰 조회
    const csrf = await request<CsrfToken>('/auth/csrf')
    if (!csrf || !['X-CSRF-TOKEN', 'X-XSRF-TOKEN'].includes(csrf.headerName)
      || typeof csrf.token !== 'string' || !csrf.token) {
      throw new ApiError(t("요청 인증 정보를 확인하지 못했습니다. 페이지를 새로고침해주세요."), 0, 'INVALID_CSRF_RESPONSE')
    }
    return request<T>(path, {
      method,
      headers: {
        [csrf.headerName]: csrf.token,
        'Content-Type': body === undefined ? false : 'application/json',
      },
      ...(body === undefined ? {} : { data: body }),
    })
  }
  const outcome = mutationQueue.then(send, send)
  mutationQueue = outcome.then(() => undefined, () => undefined)
  return outcome
}

export const apiClient = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown) => mutate<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => mutate<T>('PATCH', path, body),
  delete: <T>(path: string) => mutate<T>('DELETE', path),
}
