import { camelCase } from 'lodash';
import { IQueryKeyColumnOut, IQueryTableOut, ISend, JavaPage } from '../code-generator';
import { pascalCase } from '../utils/helper';

/**
 * 根据key生成主外建对象 增加 import
 * @param tableItem
 * @param keyColumnList
 * @param inputCol
 * @returns
 */
const findForeignKey = (
  tableItem: IQueryTableOut,
  keyColumnList: IQueryKeyColumnOut[],
  java?: JavaPage
): [string, Set<string>, Set<string>] => {
  const txtImport = new Set<string>();
  const injectService = new Set<string>();
  const columns = keyColumnList
    .map((p) => {
      if (p.tableName === tableItem.tableName) {
        // 子表是当前表
        if (
          p.referencedTableName !== p.tableName &&
          p.referencedTableName !== tableItem.tableName
        ) {
          // 非 自我关联的 需要引入父类相关对象（services、model）
          txtImport.add(
            `import ${java?.packageName}.service.impl.${pascalCase(
              p.referencedTableName
            )}ServiceImpl;`
          );
          txtImport.add(`import ${java?.packageName}.model.${pascalCase(p.referencedTableName)};`);
        }
        let hasManyTemp = '';

        if (p.referencedTableName === tableItem.tableName) {
          // 自我关联-不需要引入
          hasManyTemp = `    /**
     * ${pascalCase(tableItem.tableName)}-list: ${tableItem.tableComment}
     *
     * @param queryWrapper
     * @param orderBy
     * @param ${camelCase(p.referencedTableName)}
     * @param environment
     * @return
     */
    @SchemaMapping
    public List<${pascalCase(tableItem.tableName)}> ${camelCase(p.tableName)}${pascalCase(
            p.columnName
          )}(@Argument(name = "queryWrapper") JsonNode queryWrapper, @Argument(name = "orderBy") List<List<String>> orderBy, ${pascalCase(
            tableItem.tableName
          )} ${camelCase(p.tableName)}, DataFetchingEnvironment environment) {
        var lambdaQueryWrapper = JsonToWrapper.toQueryWrapper(queryWrapper, orderBy, environment, ${pascalCase(
          tableItem.tableName
        )}.class).lambda();
        lambdaQueryWrapper.eq(${pascalCase(p.tableName)}::get${pascalCase(
            p.columnName
          )}, ${camelCase(p.tableName)}.getId());
        return this.${camelCase(p.tableName)}Service.list(lambdaQueryWrapper);
    }`;
        } else {
          // // 声明引入对象 services
          // txtImport.add(
          //   `import ${java?.packageName}.service.impl.${pascalCase(
          //     p.referencedTableName
          //   )}ServiceImpl;`
          // );
          // txtImport.add(`import ${java?.packageName}.model.${pascalCase(p.referencedTableName)};`);

          // 非自我关联 增加 inject
          injectService.add(
            `    /**
     * ${p.refTableComment}
     */
    private ${pascalCase(p.referencedTableName)}ServiceImpl ${camelCase(
              p.referencedTableName
            )}Service;`
          );
        }
        // 子表 外键 BelongsTo
        return `    /**
     * parent-${pascalCase(p.referencedTableName)} : ${p.refTableComment}
     *
     * @param ${camelCase(tableItem.tableName)}
     * @param environment
     * @return
     */
    @SchemaMapping
    public ${pascalCase(p.referencedTableName)} ${camelCase(p.referencedTableName)}(${pascalCase(
          tableItem.tableName
        )} ${camelCase(tableItem.tableName)}, DataFetchingEnvironment environment) {
        var lambdaQueryWrapper = JsonToWrapper.toQueryWrapper(environment, ${pascalCase(
          p.referencedTableName
        )}.class).lambda();
        lambdaQueryWrapper.eq(${pascalCase(p.referencedTableName)}::getId, ${camelCase(
          tableItem.tableName
        )}.get${pascalCase(p.columnName)}());
        return this.${camelCase(p.referencedTableName)}Service.getOne(lambdaQueryWrapper);
    }
${hasManyTemp}`;
      } else {
        // 子表 b
        if (p.referencedTableName !== p.tableName) {
          txtImport.add(
            `import ${java?.packageName}.service.impl.${pascalCase(p.tableName)}ServiceImpl;
import ${java?.packageName}.model.${pascalCase(p.tableName)};`
          );
          txtImport.add(`import ${java?.packageName}.model.${pascalCase(p.referencedTableName)};`);

          // 非自我关联 增加 inject
          injectService.add(
            `    /**
     * ${p.tableComment}
     */
    private ${pascalCase(p.tableName)}ServiceImpl ${camelCase(p.tableName)}Service;`
          );
        }

        // 主表 主键 Hasmany
        return `    /**
     * ${pascalCase(p.tableName)}: ${p.tableComment}
     *
     * @param queryWrapper
     * @param orderBy
     * @param dataDictionaryTitle
     * @param environment
     * @return
     */
    @SchemaMapping
    public List<${pascalCase(p.tableName)}> ${camelCase(
          p.tableName
        )}Array(@Argument(name = "queryWrapper") JsonNode queryWrapper, @Argument(name = "orderBy") List<List<String>> orderBy, ${pascalCase(
          tableItem.tableName
        )} ${camelCase(tableItem.tableName)}, DataFetchingEnvironment environment) {
        var lambdaQueryWrapper = JsonToWrapper.toQueryWrapper(queryWrapper, orderBy, environment, DataDictionaryItem.class).lambda();
        lambdaQueryWrapper.eq(${pascalCase(p.tableName)}::get${pascalCase(
          p.columnName
        )}, dataDictionaryTitle.getId());
        return this.${camelCase(p.tableName)}Service.list(lambdaQueryWrapper);
    }
`;
      }
    })
    .join(``);
  return [columns, txtImport, injectService];
};

const modelTemplate = ({
  className,
  filedResolver,
  importFiled,
  injectService,
  java,
}: {
  className: string;
  filedResolver: string;
  importFiled: string;
  injectService: string;
  java?: JavaPage;
}) => {
  return `package ${java?.packageName}.resolvers;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import ${java?.packageName}.graphqlutil.FindInput;
import ${java?.packageName}.graphqlutil.JsonToWrapper;
import ${java?.packageName}.model.${className};
// region import
${importFiled}
// endregion
import ${java?.packageName}.service.impl.${className}ServiceImpl;
import com.fasterxml.jackson.databind.JsonNode;
import graphql.schema.DataFetchingEnvironment;
import lombok.AllArgsConstructor;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.graphql.data.method.annotation.SchemaMapping;
import org.springframework.stereotype.Controller;

import java.util.Collection;
import java.util.List;


@Controller
@AllArgsConstructor
public class ${className}Resolvers {

    private ${className}ServiceImpl ${camelCase(className)}Service;${injectService}

    // region query
    @QueryMapping
    public Iterable<${className}> findAll${className}(@Argument(name = "queryWrapper") JsonNode queryWrapper, @Argument(name = "orderBy") List<List<String>> orderBy, DataFetchingEnvironment environment) {
        return this.${camelCase(
          className
        )}Service.list(JsonToWrapper.toQueryWrapper(queryWrapper, orderBy, environment, ${className}.class));
    }

    @QueryMapping
    public ${className} find${className}(@Argument(name = "id") String id, DataFetchingEnvironment environment) {
        var lambdaQueryWrapper = JsonToWrapper.selectWrapperByFields(environment, ${className}.class).lambda();
        lambdaQueryWrapper.eq(${className}::getId, id);
        return this.${camelCase(className)}Service.getOne(lambdaQueryWrapper);
    }

    @QueryMapping
    public Long findCount${className}(@Argument(name = "queryWrapper") JsonNode queryWrapper) {
        return this.${camelCase(
          className
        )}Service.count(JsonToWrapper.toQueryWrapper(queryWrapper, ${className}.class));
    }

    @QueryMapping
    public Page<${className}> findPage${className}(@Argument("findInput") FindInput findInput, DataFetchingEnvironment environment) {
        return this.${camelCase(className)}Service.page(new Page<>(findInput.getCurrent(),
                        findInput.getSize()),
                JsonToWrapper.toQueryWrapper(findInput.getQueryWrapper(), findInput.getOrderBy(), environment, ${className}.class));
    }
    // endregion

    // regioin mutation
    @MutationMapping
    public String save${className}(@Argument("param") ${className} param) {
        this.${camelCase(className)}Service.save(param);
        return param.getId();
    }

    @MutationMapping
    public ${className} upset${className}(@Argument("param") ${className} param) {
        this.${camelCase(className)}Service.saveOrUpdate(param);
        return param;
    }

    @MutationMapping
    public boolean upsetWrapper${className}(@Argument("param") ${className} param, @Argument("wrapper") JsonNode wrapper) {
        return this.${camelCase(
          className
        )}Service.saveOrUpdate(param, JsonToWrapper.toQueryWrapper(wrapper, ${className}.class));
    }

    @MutationMapping
    public boolean saveBatch${className}(@Argument("param") Collection<${className}> param) {
        return this.${camelCase(className)}Service.saveBatch(param);
    }

    @MutationMapping
    public boolean remove${className}(@Argument("id") String id) {
        return this.${camelCase(className)}Service.removeById(id);
    }
    // endregion

    // region property
${filedResolver}
    // endregion
}`;
};

export const send = ({ java, tableItem, keyColumnList }: ISend) => {
  const [filedResolver, importFiled, injectService] = findForeignKey(
    tableItem,
    keyColumnList,
    java
  );
  return modelTemplate({
    className: pascalCase(tableItem.tableName),
    filedResolver,
    importFiled: Array.from(importFiled).join(`
`),
    injectService: Array.from(injectService).join(','),
    java,
  });
};
