<script setup lang="ts">
const route = useRoute()
navigateTo(`/dashboard/collections/${route.params.uuid}`, { redirectCode: 301 })
</script>
