import type { AuthContext } from "../../../common/auth-context";
import type { Paginated } from "../../../common/pagination";
import type {
  AuthResponseDto,
  ChangePasswordDto,
  CreateUserDto,
  ListUsersQuery,
  LoginDto,
  MeResponseDto,
  TokenPair,
  UpdateProfileDto,
  UpdateUserDto,
  UserResponseDto,
} from "../user.types";

export interface IUserService {
  login(input: LoginDto, ip?: string): Promise<AuthResponseDto>;
  refresh(refreshToken: string): Promise<TokenPair>;
  logout(refreshToken: string): Promise<void>;
  changePassword(auth: AuthContext, input: ChangePasswordDto): Promise<void>;
  getMe(auth: AuthContext): Promise<MeResponseDto>;
  updateMe(auth: AuthContext, input: UpdateProfileDto): Promise<UserResponseDto>;
  create(auth: AuthContext, input: CreateUserDto): Promise<UserResponseDto>;
  list(query: ListUsersQuery): Promise<Paginated<UserResponseDto>>;
  getById(id: string): Promise<UserResponseDto>;
  update(auth: AuthContext, id: string, input: UpdateUserDto): Promise<UserResponseDto>;
  remove(auth: AuthContext, id: string): Promise<void>;
}
