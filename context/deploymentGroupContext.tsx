import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react'

type DeploymentGroupContextProps = {
  deploymentGroups: string[]
  fetchDeploymentGroups: () => void
  refreshing: boolean
  ready: boolean
}

type DeploymentProps = {
  children: ReactNode
}

type Reader = {
  consumer_group: string
  model_type: string
}

interface Data {
  live_readers: { [key: string]: Reader }
}

const DeploymentGroupContext = createContext<DeploymentGroupContextProps | undefined>(undefined)

export const DeploymentGroupProvider = ({ children }: DeploymentProps) => {
  const [deploymentGroups, setDeploymentGroups] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState<boolean>(true)
  const [ready, setReady] = useState<boolean>(false)

  async function fetchDeploymentGroups() {
    const url = 'status'

    setRefreshing(true)
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const data: Data = await response.json()
      // Map to store consumer groups that have an EMBEDDING reader (should not be included)
      const groupMap = new Map()
      const groups = Object.values(data['live_readers']).reduce(
        (accumulator: string[], reader: Reader) => {
          if (reader.model_type === 'EMBEDDING') {
            // Mark the consumer group as having an EMBEDDING reader
            groupMap.set(reader.consumer_group, true)
          } else if (!groupMap.has(reader.consumer_group)) {
            // Include the consumer_group if it's not marked as having an EMBEDDING reader
            accumulator.push(reader.consumer_group)
          }
          return accumulator
        },
        [],
      )

      groupMap.forEach((value, key) => {
        if (value) {
          const index = groups.indexOf(key)
          if (index !== -1) {
            groups.splice(index, 1)
          }
        }
      })

      setDeploymentGroups(groups)
      if (groups.length > 0) {
        setReady(true)
      }
      setRefreshing(false)
    } catch (err) {
      setRefreshing(false)
      console.log(err)
    }
  }

  useEffect(() => {
    const pollingInterval = setInterval(() => {
      // Only poll for deployments if no readers have been deployed yet
      if (!ready) {
        fetchDeploymentGroups()
      }
    }, 1000)
    // Stop polling if the first deployment has been received
    if (ready) {
      clearInterval(pollingInterval)
    }
    return () => clearInterval(pollingInterval)
  }, [ready])

  return (
    <DeploymentGroupContext.Provider
      value={{ deploymentGroups, fetchDeploymentGroups, refreshing, ready }}
    >
      {children}
    </DeploymentGroupContext.Provider>
  )
}

export const useDeploymentGroup = () => {
  const context = useContext(DeploymentGroupContext)
  if (!context) {
    throw new Error('useDeploymentGroup must be used within a DeploymentGroupProvider')
  }
  return context
}
