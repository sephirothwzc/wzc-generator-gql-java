import { camelCase } from 'lodash';
import {
  IQueryColumnOut,
  IQueryKeyColumnOut,
  IQueryTableOut,
  ISend,
  JavaPage,
} from '../code-generator';
import { camelCaseNumber, pascalCase } from '../utils/helper';

/**
 * 全局引用需要清空
 */
const importList = new Set<string>();
/**
 * 是否引入
 */
let autoResultMap = ''; // ', autoResultMap = true';

const notColumn = [
  'id',
  'created_at',
  'updated_at',
  'deleted_at',
  'created_user',
  'updated_user',
  'created_id',
  'updated_id',
  'deleted_id',
  'i18n',
  'enable_flag',
];

const findTypeTxt = (p: IQueryColumnOut): string => {
  switch (p.dataType) {
    case 'bigint':
    case 'nvarchar':
    case 'varchar':
      return 'String';
    case 'timestamp': // GraphQLTimestamp
    case 'datetime':
      importList.add(`
import java.time.LocalDateTime;`);
      return 'LocalDateTime';
    case 'int':
      return 'Integer';
    case 'decimal':
    case 'double':
      return 'Float';
    case 'boolean':
    case 'tinyint':
      return 'Boolean';
    case 'json':
      autoResultMap = ', autoResultMap = true';
      importList.add(`
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;`);
      return 'Object';
    default:
      return 'String';
  }
};

/**
 * 根据key生成主外建对象 增加 import
 * @param tableItem
 * @param keyColumnList
 * @param inputCol
 * @returns
 */
const findForeignKey = (
  columnList: IQueryColumnOut[],
  tableItem: IQueryTableOut,
  keyColumnList: IQueryKeyColumnOut[],
  java?: JavaPage
): [string, string] => {
  const normalColumns = columnList
    .filter((p) => !notColumn.includes(p.columnName))
    .map((p) => {
      const modelPropertyType = findTypeTxt(p);
      const propertyName = camelCaseNumber(p.columnName);
      const comment = p.columnComment || p.columnName;
      // 判断长度
      let maxValid = '';
      if (modelPropertyType === 'String') {
        importList.add(`
import org.hibernate.validator.constraints.Length;`);
        maxValid = `
  @Length(max = ${p.characterMaximumLength || 50}, message = "${p.columnComment || ''}长度不能超过${
          p.characterMaximumLength || '50'
        }")`;
      }
      // 增加非空判断
      let notNull = '';
      if (p.isNullable === 'NO') {
        importList.add(`
import ${java?.packageName}${java?.modelPackage}.util.UpsetNotBlankField;`);
        notNull = `
	@UpsetNotBlankField`;
      }
      let tableField = '';
      if (modelPropertyType === 'Object') {
        // json
        importList.add(`
import com.baomidou.mybatisplus.annotation.TableField;`);
        tableField = `
	@TableField(typeHandler = JacksonTypeHandler.class)`;
      }
      return `
    /**
     * ${comment}
     */${tableField}${notNull}${maxValid}
    private ${modelPropertyType} ${propertyName};`;
    })
    .join('');

  const listCreateColumns = keyColumnList
    .filter(
      (p) => p.tableName !== tableItem.tableName || p.referencedTableName === tableItem.tableName
    )
    .map((p) => {
      importList.add(`
import java.util.List;`);
      importList.add(`
import com.baomidou.mybatisplus.annotation.TableField;`);
      // 主表 主键 Hasmany
      return `
    /**
     * ${pascalCase(p.columnName)}-${p.tableComment}
     */
    @TableField(exist = false)
    private List<${pascalCase(p.tableName)}> ${camelCase(p.tableName)}Array;`;
    })
    .join(``);
  return [normalColumns, listCreateColumns];
};

const modelTemplate = ({
  tableName,
  className,
  columns,
  java,
  listCreateColumns,
}: {
  tableName: string;
  className: string;
  columns: string;
  java?: JavaPage;
  listCreateColumns: string;
}) => {
  const importStr = Array.from(importList).join(``);
  return `package ${java?.packageName}${java?.modelPackage}.model;
${importStr}
import com.baomidou.mybatisplus.annotation.TableName;
import ${java?.packageName}${java?.modelPackage}.base.BaseModel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

@TableName(value = "${tableName}"${autoResultMap})
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class ${className} extends BaseModel implements Serializable {
${columns}
${listCreateColumns}
}
`;
};

export const send = ({ columnList, java, tableItem, keyColumnList }: ISend) => {
  // 初始化清空
  importList.clear();
  autoResultMap = '';

  const [columns, listCreateColumns] = findForeignKey(columnList, tableItem, keyColumnList, java);
  return modelTemplate({
    tableName: tableItem.tableName,
    className: pascalCase(tableItem.tableName),
    columns,
    listCreateColumns,
    java,
  });
};
