import { camelCase, upperFirst } from 'lodash';

/**
 * 帕斯卡命名
 */
export const pascalCase = (name: string) => {
  return upperFirst(camelCase(name));
};

/**
 * 自定义处理下划线数字的命名
 * @param name
 */
export const camelCaseNumber = (name: string) => {
  const nameList = name.split('_');
  const newName = nameList
    .map((p, index) => {
      if (index === 0) {
        return camelCase(p);
      }
      if (!isNaN(Number(p))) {
        let t = `_${p}`;
        if (index < nameList.length - 1) {
          t += '_';
        }
        return t;
      }
      return upperFirst(camelCase(p));
    })
    .join('');
  return newName;
};
