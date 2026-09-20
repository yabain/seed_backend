import {
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AskOriziaDto {
  @IsString()
  @MinLength(1, { message: 'La question ne peut pas être vide.' })
  @MaxLength(2000, {
    message: 'La question ne peut pas dépasser 2000 caractères.',
  })
  message: string;

  /** Identifiant de la conversation à poursuivre (facultatif). */
  @IsOptional()
  @IsMongoId()
  conversationId?: string;

  /**
   * Identifiant unique daté du visiteur non connecté
   * (`udm-AAAA-MM-JJ-<aléatoire>`), conservé dans le `localStorage` du navigateur.
   * Ignoré lorsqu'un utilisateur est authentifié.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  visitorId?: string;
}
