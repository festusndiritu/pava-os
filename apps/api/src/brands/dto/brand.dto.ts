import { RequiredName } from '../../common/validation/trimmed.js';

export class CreateBrandDto {
  @RequiredName()
  name!: string;
}

export class UpdateBrandDto extends CreateBrandDto {}
