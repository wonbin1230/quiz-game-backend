export const getRandomElementByPortionNoDuplicate = <T extends { portion: number }>(
  elements: T[],
  count: number,
): T[] => {
  if (elements.length < count) return Array.from(elements)
  const result = []
  let targetList: T[] = Array.from(elements)
  for (let i = 0; i < count; i++) {
    const randomElement = getRandomElementByPortion(targetList)
    result.push(randomElement)
    targetList = targetList.filter((r) => r !== randomElement)
  }
  return result
}

export const getRandomElementByPortion = <T extends { portion: number }>(elements: T[]): T => {
  const totalPortion = elements.reduce((total, element) => {
    return total + element.portion
  }, 0)

  const randomPortion = Math.floor(Math.random() * totalPortion)
  let currentPortion = 0
  for (const element of elements) {
    currentPortion += element.portion
    if (currentPortion > randomPortion) {
      return element
    }
  }
  return elements[elements.length - 1]
}

export const getRandomInclusiveInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export const getRandomElement = <T>(elements: T[]): T => {
  return elements[Math.floor(Math.random() * elements.length)]
}

export const getRandomElements = <T>(elements: T[], count: number): T[] => {
  const result: T[] = []
  for (let i = 0; i < count; i++) {
    result.push(getRandomElement(elements))
  }
  return result
}

export const getNonDuplicatedRandomElements = <T>(elements: T[], count: number): T[] => {
  if (elements.length < count) return elements
  const result: T[] = []
  const elementsCopy = [...elements]
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * elementsCopy.length)
    result.push(elementsCopy[randomIndex])
    elementsCopy.splice(randomIndex, 1)
  }
  return result
}