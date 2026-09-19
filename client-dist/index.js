// @ts-nocheck
// 浏览器入口：import 由 Koishi Console 转换，直接复用宿主运行时，无需构建依赖。
import { send, SchemaBase } from '@koishijs/client';
import { defineComponent, h, ref, watch, onMounted, onBeforeUnmount, resolveComponent } from 'vue';

/** @param {any} ctx @param {any} data */
export default function apply(ctx, data) {
    ctx.schema({
        type: 'union',
        role: 'phi-plugin-shortcuts',
        component: defineComponent({
            props: ['schema', 'modelValue', 'disabled'],
            emits: ['update:modelValue'],
            setup(props, { emit }) {
                const tree = ref(null)
                const extra = () => props.schema.meta.extra
                const selection = () => props.modelValue ?? data.value.shortcuts ?? [
                    ...extra().categories.map(key => `category:${key}`),
                    ...extra().commands.map(key => `command:${key}`),
                ]
                watch(() => props.modelValue, () => tree.value?.setCheckedKeys(selection()), { deep: true, flush: 'post' })
                const update = (_, state) => {
                    if (props.disabled) return
                    emit('update:modelValue', [...state.checkedKeys])
                }
                return () => h(SchemaBase, {}, {
                    title: () => '快捷指令',
                    desc: () => h('p', '勾选分组：添加分类菜单；勾选子命令：添加顶层快捷指令。父子独立选择，不自动联动。指令与非空分组合计最多 25 个入口，保存后同步。'),
                    default: () => h(resolveComponent('el-tree'), {
                        ref: tree, data: extra().tree, nodeKey: 'id', showCheckbox: true,
                        checkStrictly: true, expandOnClickNode: false,
                        defaultCheckedKeys: selection(),
                        props: { label: 'label', children: 'children', disabled: () => props.disabled },
                        onCheck: update,
                        style: { padding: '8px 16px', background: 'transparent' },
                    }),
                })
            },
        }),
    })
    const job = ref(null)
    const pending = ref(false)
    const error = ref('')
    let alive = true
    ctx.effect(() => () => { alive = false })

    function errorText(reason) {
        const text = String(reason).split('\n')[0].replace(/^Error:\s*/, '')
        if (text === 'unauthorized') return '需要控制台管理员权限（等级 4）。'
        if (text === 'timeout') return '请求超时，请刷新页面查看更新状态。'
        return text
    }

    async function refresh() {
        const result = await send(data.value.event, 'status')
        if (result === undefined) throw new Error('控制台连接已断开，请刷新后重试。')
        if (alive) job.value = result
    }

    ctx.schema({
        role: 'phi-plugin-update',
        component: defineComponent({
            props: ['schema', 'disabled'],
            setup(/** @type {any} */ props) {
                let mounted = true
                /** @type {ReturnType<typeof setTimeout> | undefined} */
                let timer
                async function poll() {
                    if (!mounted || !alive) return
                    try {
                        await refresh()
                        error.value = ''
                    } catch (reason) {
                        error.value = errorText(reason)
                    }
                    if (mounted && alive && job.value?.state === 'running') timer = setTimeout(poll, 1500)
                }
                async function start() {
                    if (pending.value || job.value?.state === 'running') return
                    pending.value = true
                    error.value = ''
                    try {
                        job.value = await send(data.value.event, 'start', props.schema.meta.extra.target)
                        if (!job.value) throw new Error('控制台连接已断开，请刷新后重试。')
                        await poll()
                    } catch (reason) {
                        error.value = errorText(reason)
                    } finally {
                        pending.value = false
                    }
                }
                onMounted(poll)
                onBeforeUnmount(() => { mounted = false; clearTimeout(timer) })
                return () => {
                    const target = props.schema.meta.extra.target
                    const title = target === 'plugin' ? '更新插件' : '更新曲绘库'
                    const result = job.value?.target === target ? job.value : null
                    const text = error.value || result?.message || ''
                    return h(SchemaBase, {}, {
                        title: () => title,
                        desc: () => h('p', { role: 'status', style: { color: error.value || result?.state === 'error' ? 'var(--el-color-danger)' : undefined } }, text),
                        control: () => h(resolveComponent('el-button'), {
                            type: 'primary', disabled: props.disabled || pending.value || job.value?.state === 'running',
                            loading: result?.state === 'running', onClick: start,
                        }, () => title),
                    })
                }
            },
        }),
    })
}
