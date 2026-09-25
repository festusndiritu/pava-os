import { RequiredName } from '../../common/validation/trimmed.js';

export class CreateCategoryDto {
  @RequiredName()
  name!: string;
}

export class UpdateCategoryDto extends CreateCategoryDto {}
