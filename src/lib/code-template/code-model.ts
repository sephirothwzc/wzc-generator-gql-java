import { camelCase } from 'lodash';
import {
  IQueryColumnOut,
  IQueryKeyColumnOut,
  IQueryTableOut,
  ISend,
  JavaPage,
} from '../code-generator';
import { pascalCase } from '../utils/helper';

/**
 * 全局引用需要清空
 */
const importList = new Set<string>();

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
      importList.add(`
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.fasterxml.jackson.databind.JsonNode;`);
      return 'JsonNode';
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
  keyColumnList: IQueryKeyColumnOut[]
): [string, string] => {
  const normalColumns = columnList
    .filter((p) => !notColumn.includes(p.columnName))
    .map((p) => {
      const modelPropertyType = findTypeTxt(p);
      const propertyName = camelCase(p.columnName);
      const comment = p.columnComment || p.columnName;
      let tableField = '';
      if (propertyName === 'JsonNode') {
        tableField = `
	@TableField(typeHandler = JacksonTypeHandler.class)`;
      }
      return `
    /**
     * ${comment}
     */${tableField}
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

@TableName("${tableName}")
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

  const [columns, listCreateColumns] = findForeignKey(columnList, tableItem, keyColumnList);
  return modelTemplate({
    tableName: tableItem.tableName,
    className: pascalCase(tableItem.tableName),
    columns,
    listCreateColumns,
    java,
  });
};
