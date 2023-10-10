import { camelCase } from 'lodash';
import { IQueryColumnOut, IQueryKeyColumnOut, IQueryTableOut, ISend } from '../code-generator';
import { camelCaseNumber, pascalCase } from '../utils/helper';

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
): [string, string, string] => {
  // const txtImport = new Set<string>();
  // const injectService = new Set<string>();
  const otherColumns = keyColumnList
    .map((p) => {
      if (p.tableName === tableItem.tableName) {
        // 自我关联
        if (p.referencedTableName === tableItem.tableName) {
          return `
    # children-${p.refTableComment}
    ${camelCase(p.tableName)}${pascalCase(
            p.columnName
          )}Array(queryWrapper: JSON,orderBy:[[String!]]): [${pascalCase(p.tableName)}]`;
        }
        // 非自我关联
        // 当前表为子表 外键 BelongsTo
        return `
    # ${camelCase(p.columnName)}-${p.refTableComment}
    ${camelCase(p.referencedTableName)}${inputCol}: ${pascalCase(p.referencedTableName)}`;
      } else {
        // 当前表为主表 主键 Hasmany
        return `
    # ${pascalCase(p.columnName)}-${p.refTableComment}
    ${camelCase(
      p.tableName
    )}${inputCol}Array(queryWrapper: JSON,orderBy:[[String!]]): [${pascalCase(p.tableName)}]
  `;
      }
    })
    .join(``);

  /**
   * input 保存 子表list
   */
  const inputOtherColumns = keyColumnList
    .filter((p) => p.tableName !== tableItem.tableName)
    .map((p) => {
      // 当前表为主表 主键 Hasmany
      return `
    # ${pascalCase(p.columnName)}-${p.tableComment}
    ${camelCase(p.tableName)}${inputCol}Array: [Save${pascalCase(p.tableName)}Input!]
  `;
    })
    .join(``);

  const normal = columnList
    .filter((p) => !notColumn.includes(p.columnName))
    .map((p) => {
      const gqlType = findTypeTxt(p);
      const propertyName = camelCaseNumber(p.columnName);
      const comment = p.columnComment || p.columnName;

      const gqlNullable = p.isNullable === 'YES' ? '' : '!';
      return `
    # ${comment}
    ${propertyName}: ${gqlType}${gqlNullable}
`;
    })
    .join('');
  return [normal, otherColumns, inputOtherColumns];
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
  tableComment,
  inputOtherColumns,
}: {
  className: string;
  columns: string;
  otherColumns: string;
  tableComment: string;
  inputOtherColumns: string;
}) => {
  return `# ${tableComment}
type ${className} {
${columns}${otherColumns}
}

# 分页 ${tableComment}
type Page${className} implements PageType{
    # 页面行数
    size: Long
    current: Long
    total: Long
    pages: Long
    records: [${className}]
}

# 保存 ${tableComment}
input Save${className}Input {
${columns.replace('id: String!', 'id: String')}
}

input Create${className}Input {
${columns.replace('id: String!', 'id: String')}${inputOtherColumns}
}

input Upset${className}Input {
${columns.replace(/!/g, '')}${inputOtherColumns}
}


extend type Query {
    # id 获取-${tableComment}
    find${className}(id:String!):${className}
    # 条件排序获取列表-${tableComment}
    findAll${className}(queryWrapper: JSON,orderBy:[[String!]]) : [${className}]
    # 行数-${tableComment}
    findCount${className}(queryWrapper: JSON): Long!
    # 分页-${tableComment}
    findPage${className}(findInput:FindInput): Page${className}
    # 聚合
    findPolymerization${className}(polymerizationInput: PolymerizationInput): [${className}]
}

extend type Mutation {
    # 主子表新增
    create${className}(param: Create${className}Input): ${className}
    # 创建 返回 id-${tableComment}
    save${className}(param: Save${className}Input!): String
    # 更新 or 插入 根据id-${tableComment}
    upset${className}(param:Upset${className}Input!): ${className}
    # 有条件更新-${tableComment}
    upsetWrapper${className}(param:Upset${className}Input!,wrapper: JSON): Boolean
    # 批量插入-${tableComment}
    saveBatch${className}(param:[Save${className}Input!]!): Boolean
    # 批量保存（有id修改，无id新增）-${tableComment}支持主子表
    upsetBatch${className}(param:[Upset${className}Input!]!): Boolean
    # 批量修改-${tableComment}
    updateBatch${className}(param:[Upset${className}Input!]!): Boolean
    # 根据id删除-${tableComment}
    remove${className}(id:String!): Boolean
}
`;
};

export const send = ({ columnList, tableItem, keyColumnList }: ISend) => {
  const [columns, otherColumns, inputOtherColumns] = findForeignKey(
    columnList,
    tableItem,
    keyColumnList
  );
  return modelTemplate({
    className: pascalCase(tableItem.tableName),
    columns,
    otherColumns,
    tableComment: tableItem.tableComment,
    inputOtherColumns,
  });
};
