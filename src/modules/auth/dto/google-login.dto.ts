import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Le jeton Google est requis' })
  idToken: string;
}
