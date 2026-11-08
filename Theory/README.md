# Theory

Заметки разложены по трекам. Имя файла уникально, поэтому ссылки Obsidian вида `[[why-service]]` не зависят от папки.

| Трек | О чём |
|------|--------|
| `00-overview` | вход: что такое Kubernetes, глоссарий, [learning-path](00-overview/learning-path.md), вопросы без ответа |
| `01-workloads` | Deployment, ReplicaSet, DaemonSet, пробы, rolling update |
| `02-networking` | Service, EndpointSlice, типы Service, путь пакета, Ingress |
| `03-scheduling` | куда планировщик ставит под |
| `04-config` | ConfigMap, Secret, двенадцатифакторка, Spring Config Server |
| `05-operations` | kubectl, откуда берётся образ, порядок apply |
| `06-organization` | namespace, labels, selectors |

Практика к заметкам — каталоги в `Manifests/`, не простыни из нескольких kind в одном файле. Поломанные варианты — только `Manifests/incidents/`.
