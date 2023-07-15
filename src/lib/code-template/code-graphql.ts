import { camelCase } from 'lodash';
import { IQueryColumnOut, IQueryKeyColumnOut, IQueryTableOut, ISend } from '../code-generator';
import { pascalCase } from '../utils/helper';

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
  'enable_flage',
];

const findTypeTxt = (p: IQueryColumnOut): string => {
  switch (p.dataType) {
    case 'bigint':
    case 'nvarchar':
    case 'varchar':
    case 'timestamp': // GraphQLTimestamp
    case 'datetime':
      return 'String';
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
  keyColumnList: IQueryKeyColumnOut[],
  inputCol = ''
): [string, string] => {
  // const txtImport = new Set<string>();
  // const injectService = new Set<string>();
  const otherColumns = keyColumnList
    .map((p) => {
      if (p.tableName === tableItem.tableName) {
        let hasManyTemp = '';
        // 自我关联
        if (p.referencedTableName === tableItem.tableName) {
          hasManyTemp = `
    # Parent
    ${camelCase(p.tableName)}${pascalCase(p.columnName)}: ${pascalCase(p.tableName)}`;
        }
        // 当前表为子表 外键 BelongsTo
        return `
    # ${camelCase(p.columnName)}
    ${camelCase(p.referencedTableName)}${inputCol}: ${pascalCase(p.referencedTableName)}
${hasManyTemp}`;
      } else {
        // 当前表为主表 主键 Hasmany
        return `
    # ${pascalCase(p.columnName)}
    ${camelCase(p.tableName)}${inputCol}Array: ${pascalCase(p.tableName)}
  `;
      }
    })
    .join(``);

  const normal = columnList
    .filter((p) => !notColumn.includes(p.columnName))
    .map((p) => {
      const gqlType = findTypeTxt(p);
      const propertyName = camelCase(p.columnName);
      const comment = p.columnComment || p.columnName;

      const gqlNullable = p.isNullable === 'YES' ? '!' : '';
      return `
    # ${comment}
    ${propertyName}: ${gqlType}${gqlNullable}
`;
    })
    .join('');
  return [normal, otherColumns];
};

/**
 * 模版生成
 * @param param
 * @returns
 */
const modelTemplate = ({
  className,
  columns,
  otherColumns,
}: {
  className: string;
  columns: string;
  otherColumns: string;
}) => {
  return `type ${className} {
${columns}${otherColumns}
}

type Page${className} implements PageType{
    # 页面行数
    size: Long
    current: Long
    total: Long
    pages: Long
    records: [${className}]
}

input Save${className}Input {
${columns}
}

extend type Query {
    # id 获取对象
    find${className}(id:String!):${className}
    # 条件排序获取列表
    findAll${className}(queryWrapper: JSON,orderBy:[[String!]]) : [${className}]
    # 行数
    findCount${className}(queryWrapper: JSON): Long!
    # 分页
    findPage${className}(findInput:FindInput): Page${className}
}

extend type Mutation {
    # 创建 返回 id
    save${className}(param: Save${className}Input!): String
    # 更新 or 插入 根据id
    upset${className}(param:Save${className}Input!): ${className}
    # 有条件更新
    upsetWrapper${className}(param:Save${className}Input!,wrapper: JSON): Boolean
    # 批量插入
    saveBatch${className}(param:[Save${className}Input!]!): Boolean
    # 根据id删除
    remove${className}(id:String!): Boolean
}
`;
};

export const send = ({ columnList, tableItem, keyColumnList }: ISend) => {
  const [columns, otherColumns] = findForeignKey(columnList, tableItem, keyColumnList);
  return modelTemplate({
    className: pascalCase(tableItem.tableName),
    columns,
    otherColumns,
  });
};
