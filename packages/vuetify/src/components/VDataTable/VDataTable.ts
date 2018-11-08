import '../../stylus/components/_data-table.styl'

import { VNode, VNodeChildrenArrayContents } from 'vue'
import { DataProps, DataOptions } from '../VData/VData'
import { deepEqual, getObjectValueByPath, convertToUnit } from '../../util/helpers'
import VDataTableHeader, { TableHeader } from './VDataTableHeader'
import { PropValidator } from 'vue/types/options'
import VRow from './VRow'
import { VData, VDataFooter } from '../VData'
import VDataIterator from '../VDataIterator'
import VIcon from '../VIcon'
import VSimpleCheckbox from '../VCheckbox/VSimpleCheckbox'
import VBtn from '../VBtn'
import VRowGroup from './VRowGroup'
import VDataTableHeaderMobile from './VDataTableHeaderMobile'
import VProgressLinear from '../VProgressLinear'

/* @vue/component */
export default VDataIterator.extend({
  name: 'v-data-table',

  provide (): object {
    return { dataTable: this }
  },

  props: {
    headers: {
      type: Array,
      required: true
    } as PropValidator<TableHeader[]>,
    showSelect: Boolean,
    showExpand: Boolean,
    virtualRows: Boolean,
    mobileBreakpoint: {
      type: String,
      default: 'sm'
    },
    height: [Number, String],
    hideDefaultFooter: Boolean,
    hideDefaultHeader: Boolean
  },

  data () {
    return {
      internalGroupBy: [] as string[],
      openCache: {} as { [key: string]: boolean }
    }
  },

  computed: {
    computedHeaders (): TableHeader[] {
      const headers = this.headers.filter(h => h.value === undefined || !this.internalGroupBy.find(v => v === h.value))

      this.showSelect && headers.unshift({ text: '', value: 'dataTableSelect', sortable: false, width: '1px' })
      this.showExpand && headers.unshift({ text: '', value: 'dataTableExpand', sortable: false, width: '1px' })

      return headers
    },
    isMobile (): boolean {
      return !!this.$vuetify.breakpoint[this.mobileBreakpoint]
    }
  },

  created () {
    console.log(this)
  },

  methods: {
    customSortWithHeaders (items: any[], sortBy: string[], sortDesc: boolean[], locale: string) {
      const customSorters = this.computedHeaders.reduce((obj: Record<string, Function>, header: TableHeader) => {
        if (header.sort) obj[header.value] = header.sort
        return obj
      }, {})

      return this.customSort(items, sortBy, sortDesc, locale, customSorters)
    },
    createItemProps (item: any) {
      const props = VDataIterator.options.methods.createItemProps.call(this, item)
      props.headers = this.computedHeaders

      return props
    },
    createSlotProps (props: any) {
      props.headers = this.computedHeaders

      return props
    },
    genColgroup (props: DataProps) {
      return this.$createElement('colgroup', this.computedHeaders.map(header => {
        return this.$createElement('col', {
          class: {
            'divider': header.divider || header.resizable,
            'resizable': header.resizable
          },
          style: {
            width: header.width
          }
        })
      }))
    },
    genLoading () {
      const progress = this.$createElement(VProgressLinear, {
        props: {
          // color: this.dataTable.loading === true
          //   ? 'primary'
          //   : this.dataTable.loading,
          height: 2,
          indeterminate: true
        }
      })

      const th = this.$createElement('th', {
        staticClass: 'column',
        attrs: {
          colspan: this.computedHeaders.length
        }
      }, [progress])

      return this.$createElement('tr', {
        staticClass: 'v-data-table__progress'
      }, [th])
    },
    genHeaders (props: DataProps) {
      const children: VNodeChildrenArrayContents = [this.genSlots('header', this.createSlotProps(props))]

      if (!this.hideDefaultHeader) {
        children.push(this.$createElement(this.isMobile ? VDataTableHeaderMobile : VDataTableHeader, {
          props: {
            headers: this.computedHeaders,
            options: props.options
          },
          on: {
            'update:options': (options: DataOptions) => props.options = options,
            'sort': props.sort
          }
        }))
      }

      if (this.loading) children.push(this.genLoading())

      return children
    },
    genEmptyWrapper (content: VNodeChildrenArrayContents) {
      return this.$createElement('tr', [
        this.$createElement('td', {
          attrs: {
            colspan: this.computedHeaders.length
          }
        }, content)
      ])
    },
    genItems (props: DataProps): VNodeChildrenArrayContents {
      const empty = this.genEmpty()
      if (empty) return [empty]

      return props.options.groupBy.length
        ? this.genGroupedRows(props)
        : this.genRows(props)
    },
    genGroupedRows (props: DataProps): VNodeChildrenArrayContents {
      const groups = Object.keys(props.groupedItems || {})

      return groups.map(group => {
        if (!this.openCache.hasOwnProperty(group)) this.$set(this.openCache, group, true)

        if (this.$scopedSlots.group) {
          return this.$scopedSlots.group({
            group,
            items: props.groupedItems![group],
            headers: this.computedHeaders
          })
        } else {
          return this.genDefaultGroupedRow(group, props.groupedItems![group], props)
        }
      })
    },
    genDefaultGroupedRow (group: string, items: any[], props: DataProps) {
      const isOpen = !!this.openCache[group]
      const children: VNodeChildrenArrayContents = [
        this.$createElement('template', { slot: 'row.content' }, this.genDefaultRows(props))
      ]

      if (this.$scopedSlots['group.header']) {
        children.unshift(this.$createElement('template', { slot: 'column.header' }, [
          this.$scopedSlots['group.header']({ group, groupBy: props.options.groupBy, items, headers: this.computedHeaders })
        ]))
      } else {
        const toggle = this.$createElement(VBtn, {
          staticClass: 'ma-0',
          props: {
            icon: true,
            small: true
          },
          on: {
            click: () => this.$set(this.openCache, group, !this.openCache[group])
          }
        }, [this.$createElement(VIcon, [isOpen ? 'remove' : 'add'])])

        const remove = this.$createElement(VBtn, {
          staticClass: 'ma-0',
          props: {
            icon: true,
            small: true
          },
          on: {
            click: () => props.options = Object.assign({}, props.options, { groupBy: [], groupDesc: [] })
          }
        }, [this.$createElement(VIcon, ['close'])])

        const column = this.$createElement('td', {
          staticClass: 'text-xs-left',
          attrs: {
            colspan: this.computedHeaders.length
          }
        }, [toggle, `${props.options.groupBy[0]}: ${group}`, remove])

        children.unshift(this.$createElement('template', { slot: 'column.header' }, [column]))
      }

      if (this.$scopedSlots['group.summary']) {
        children.push(this.$createElement('template', { slot: 'column.summary' }, [
          this.$scopedSlots['group.summary']({ group, groupBy: props.options.groupBy, items, headers: this.computedHeaders })
        ]))
      }

      return this.$createElement(VRowGroup, {
        props: {
          value: isOpen
        }
      }, children)
    },
    genRows (props: DataProps): VNodeChildrenArrayContents {
      return this.$scopedSlots.item ? this.genScopedRows(props) : this.genDefaultRows(props)
    },
    genScopedRows (props: DataProps): VNodeChildrenArrayContents {
      return props.items.map((item: any) => this.$scopedSlots.item(this.createItemProps(item)))
    },
    genDefaultRows (props: DataProps): VNodeChildrenArrayContents {
      return this.$scopedSlots['item.expanded']
        ? props.items.map(item => this.genDefaultExpandedRow(item))
        : props.items.map(item => this.genDefaultSimpleRow(item))
    },
    genDefaultExpandedRow (item: any): VNode {
      const isExpanded = this.isExpanded(item)
      const headerRow = this.genDefaultSimpleRow(item, isExpanded ? 'expanded expanded__row' : null)
      const expandedRow = this.$createElement('tr', {
        staticClass: 'expanded expanded__content'
      }, [this.$scopedSlots['item.expanded']({ item, headers: this.computedHeaders })])

      return this.$createElement(VRowGroup, {
        props: {
          value: isExpanded
        }
      }, [
        this.$createElement('template', { slot: 'row.header' }, [headerRow]),
        this.$createElement('template', { slot: 'row.content' }, [expandedRow])
      ])
    },
    genDefaultSimpleRow (item: any, classes: string | string[] | object | null = null): VNode {
      const scopedSlots: any = Object.keys(this.$scopedSlots).filter(k => k.startsWith('item.column.')).reduce((obj: any, k: string) => {
        obj[k.replace('item.column.', '')] = this.$scopedSlots[k]
        return obj
      }, {})

      if (this.showSelect) {
        scopedSlots['dataTableSelect'] = () => this.$createElement(VSimpleCheckbox, {
          staticClass: 'v-data-table__checkbox',
          props: {
            value: this.isSelected(item)
          },
          on: {
            input: (v: any) => this.select(item, v)
          }
        })
      }

      const expanded = this.isExpanded(item)

      if (this.showExpand) {
        scopedSlots['dataTableExpand'] = () => this.$createElement(VIcon, {
          staticClass: 'expand__icon',
          class: {
            'expand__icon--active': expanded
          },
          on: {
            click: () => this.expand(item, !expanded)
          }
        }, [this.$vuetify.icons.expand]) // TODO: prop?
      }

      return this.$createElement(VRow, {
        key: getObjectValueByPath(item, this.itemKey),
        class: classes,
        props: {
          headers: this.computedHeaders,
          item,
          mobile: this.isMobile
        },
        scopedSlots
      })
    },
    genBody (props: DataProps): VNode | string | VNodeChildrenArrayContents {
      // if (this.$scopedSlots.body) return this.$scopedSlots.body(this.bodySlotProps(props))

      return this.$createElement('tbody', [
        this.genSlots('row.prepend', props),
        this.genItems(props),
        this.genSlots('row.append', props)
      ])
    },
    genFooters (props: DataProps) {
      const children: VNodeChildrenArrayContents = [
        this.genSlots('footer', props)
      ]

      if (!this.hideDefaultFooter) {
        children.push(this.$createElement(VDataFooter, {
          props: {
            options: props.options,
            pagination: props.pagination
          },
          on: {
            'update:options': (value: any) => props.options = value
          }
        }))
      }

      return children
    },
    genTable (props: DataProps): VNode {
      return this.$createElement('div', {
        staticClass: 'v-data-table__wrapper',
        style: {
          height: convertToUnit(this.height)
        }
      }, [
        this.$createElement('table', [
          this.genColgroup(props),
          this.genHeaders(props),
          this.genBody(props)
        ])
      ])
    },
    genDefaultScopedSlot (props: DataProps): VNode {
      // const children: VNodeChildrenArrayContents = [this.genTable(props)]

      // TODO: Do we have to support static? Is there another way?
      // if (this.static) {
      //   return this.$createElement('div', ['static'])
      // }

      if (this.virtualRows) {
        return this.$createElement('div', ['virtual'])
      }

      // const footers = computeSlots(this, 'footer', this.createSlotProps())
      // children.push(...footers, ...this.genFooter())

      return this.$createElement('div', {
        staticClass: 'v-data-table',
        class: {
          // 'v-data-table--dense': this.dense,
          'v-data-table--fixed': !!this.height,
          'v-data-table--mobile': this.isMobile,
          ...this.themeClasses
        }
      }, [
        this.genTable(props),
        this.genFooters(props)
      ])
    }
  },

  render (): VNode {
    return this.$createElement(VData, {
      props: {
        items: this.items,
        itemsLength: this.totalItems,
        options: this.options,
        page: this.page,
        itemsPerPage: this.itemsPerPage,
        sortBy: this.sortBy,
        sortDesc: this.sortDesc,
        groupBy: this.groupBy,
        groupDesc: this.groupDesc,
        customSort: this.customSortWithHeaders,
        mustSort: this.mustSort,
        multiSort: this.multiSort,
        locale: this.locale,
        disableSort: this.itemsLength >= 0,
        disablePagination: this.itemsLength >= 0
      },
      on: {
        'update:options': (v: any, old: any) => {
          this.internalGroupBy = v.groupBy || []
          !deepEqual(v, old) && this.$emit('update:options', v)
        },
        'update:page': (v: any) => this.$emit('update:page', v),
        'update:itemsPerPage': (v: any) => this.$emit('update:itemsPerPage', v),
        'update:sortBy': (v: any) => this.$emit('update:sortBy', v),
        'update:sortDesc': (v: any) => this.$emit('update:sortDesc', v),
        'update:groupBy': (v: any) => this.$emit('update:groupBy', v),
        'update:groupDesc': (v: any) => this.$emit('update:groupDesc', v),
        'pagination': (v: any, old: any) => !deepEqual(v, old) && this.$emit('pagination', v),
        'visible-items': (v: any[]) => this.visibleItems = v
      },
      scopedSlots: {
        default: this.genDefaultScopedSlot as any
      }
    })
  }
})