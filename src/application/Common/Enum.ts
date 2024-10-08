import { isString } from '@/TypeHelpers';

// Because we cannot do "T extends enum" 😞 https://github.com/microsoft/TypeScript/issues/30611
export type EnumType = number | string;
export type EnumVariable<T extends EnumType, TEnumValue extends EnumType>
  = { [key in T]: TEnumValue };

export interface EnumParser<TEnum> {
  parseEnum(value: string, propertyName: string): TEnum;
}

export function createEnumParser<T extends EnumType, TEnumValue extends EnumType>(
  enumVariable: EnumVariable<T, TEnumValue>,
): EnumParser<TEnumValue> {
  return {
    parseEnum: (value, propertyName) => parseEnumValue(value, propertyName, enumVariable),
  };
}

function parseEnumValue<T extends EnumType, TEnumValue extends EnumType>(
  value: string,
  enumName: string,
  enumVariable: EnumVariable<T, TEnumValue>,
): TEnumValue {
  if (!value) {
    throw new Error(`missing ${enumName}`);
  }
  if (!isString(value)) {
    throw new Error(`unexpected type of ${enumName}: "${typeof value}"`);
  }
  const casedValue = getEnumNames(enumVariable)
    .find((enumValue) => enumValue.toLowerCase() === value.toLowerCase());
  if (!casedValue) {
    throw new Error(`unknown ${enumName}: "${value}"`);
  }
  return enumVariable[casedValue as keyof EnumVariable<T, TEnumValue>];
}

export function getEnumNames
<T extends EnumType, TEnumValue extends EnumType>(
  enumVariable: EnumVariable<T, TEnumValue>,
): (string & keyof EnumVariable<T, TEnumValue>)[] {
  return Object
    .values(enumVariable)
    .filter((
      enumMember,
    ): enumMember is string & (keyof EnumVariable<T, TEnumValue>) => isString(enumMember));
}

export function getEnumValues<T extends EnumType, TEnumValue extends EnumType>(
  enumVariable: EnumVariable<T, TEnumValue>,
): TEnumValue[] {
  return getEnumNames(enumVariable)
    .map((name) => enumVariable[name]) as TEnumValue[];
}

export function assertInRange<T extends EnumType, TEnumValue extends EnumType>(
  value: TEnumValue,
  enumVariable: EnumVariable<T, TEnumValue>,
) {
  if (!(value in enumVariable)) {
    throw new RangeError(`enum value "${value}" is out of range`);
  }
}
