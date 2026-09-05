import { IsOptional, IsString } from "class-validator";

export class DecidePlanDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
