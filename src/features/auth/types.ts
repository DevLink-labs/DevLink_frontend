export interface User {
  userId: number
  email: string
  name: string
  nickname: string | null
  createdAt: string
}

export interface SignupInput {
  email: string
  password: string
  name: string
  nickname?: string
}

export interface LoginInput {
  email: string
  password: string
}
