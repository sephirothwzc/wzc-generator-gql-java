import { camelCase } from 'lodash';
import {
  IQueryColumnOut,
  IQueryKeyColumnOut,
  IQueryTableOut,
  ISend,
  JavaPage,
} from '../code-generator';
import { pascalCase } from '../utils/helper';

const notColumn = [
  // 'id',
  // 'created_at',
  // 'updated_at',
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
      return 'LocalDateTime';
    case 'int':
      return 'Int';
    case 'decimal':
    case 'double':
      return 'Float';
    case 'boolean':
    case 'tinyint':
      return 'Boolean';
    case 'json':
      return 'JSON';
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
): [string, string, string] => {
  const otherImport = new Set<string>();

  const normalColumns = columnList
    .filter((p) => !notColumn.includes(p.columnName))
    .map((p) => {
      const modelPropertyType = findTypeTxt(p);
      const propertyName = camelCase(p.columnName);
      const comment = p.columnComment || p.columnName;

      return `
    /**
     * ${comment}
     */
    private ${modelPropertyType} ${propertyName};`;
    })
    .join('');

  const listCreateColumns = keyColumnList
    .filter((p) => p.tableName !== tableItem.tableName)
    .map((p) => {
      otherImport.add(`
import java.util.List;`);
      otherImport.add(`
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
  return [normalColumns, listCreateColumns, Array.from(otherImport).join('')];
};

const modelTemplate = ({
  tableName,
  className,
  columns,
  java,
  listCreateColumns,
  otherImport,
}: {
  tableName: string;
  className: string;
  columns: string;
  java?: JavaPage;
  listCreateColumns: string;
  otherImport: string;
}) => {
  return `package ${java?.packageName}.model;
${otherImport}
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import ${java?.packageName}.base.BaseModel;
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
  const [columns, listCreateColumns, otherImport] = findForeignKey(
    columnList,
    tableItem,
    keyColumnList
  );
  return modelTemplate({
    tableName: tableItem.tableName,
    className: pascalCase(tableItem.tableName),
    columns,
    listCreateColumns,
    java,
    otherImport,
  });
};
